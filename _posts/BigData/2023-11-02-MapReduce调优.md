---
layout: page-with-sidebar
title: "MapReduce调优"
date: 2023-11-02 10:47:03 +0800
author: reflectt6
categories: "大数据"
#permalink: 
mainTag: "大数据"
secondaryTag: ""
---

## 背景

本篇基于HBase二级索引项目，该项目中，我使用mapreduce框架实现了对HBase二级索引一致性校验的功能。
在数据量为1T的数据表和索引表的测试过程中，发生了heap内存溢出问题，这貌似在大数据中很常见。
今天借此背景，研究一下Mapreduce调优手段。

## 数据表生成

使用PE生成数据表

hbase pe --nomapred --oneCon=true --table=Tab_1000G_write_48 --size=1000 --valueSize=48 --columns=16 --presplit=20 --compress='SNAPPY' sequentialWrite 16

注意：

- 最后的16指线程数，这个值的设定不光要考虑服务器本身的cpu核数，还要考虑RegionServer的接受能力，否则RegionServer会由于请求过多报错。
- 由于使用了“SNAPPY”压缩，最后生成的数据表并没有1T，以这条命令为例，最后大约有300G，如果集群是三副本，实际的大小为300G*3左右
- --valueSize设置的是行间的大小，这里的48就是说一个行键为48个字符。这个值也会直接影响最终生成的表大小，我试过设置为8，也是生成1000G，最终生成的表只有15G左右。原因可能在于8字符比48字符压缩更彻底。
- --columns设置列的数量，列族只有一个叫做“info0”，这里设置的数量为info0中的列的数量，如果设为3，则有“info0:0”，“info0:1”，“info0:2”

## 观察MapReduce日志

```shell
# 查看有哪些mr任务
yarn application -list -appStates All

# 根据任务id获取任务日志
yarn logs -applicationId [applicationId]
```



## MapReduce自动监测脚本

数据量上去，mapreduce任务很慢，总不能一直守着电脑看，这里给一个自动监测脚本的demo

设置定时任务，用到crontab这个命令

```shell
# 打开文本编辑 设置定时任务
crontab -e

# 格式如下

* * * * * 等待执行的脚本
格式如下 minute hour day month week command，也就是最多支持到每分钟执行 一次。其中：
minute： 表示分钟，可以是从0到59之间的任何整数。
hour：表示小时，可以是从0到23之间的任何整数。
day：表示日期，可以是从1到31之间的任何整数。
month：表示月份，可以是从1到12之间的任何整数。
week：表示星期几，可以是从0到7之间的任何整数，这里的0或7代表星期日。
command：要执行的命令，可以是系统命令，也可以是自己编写的脚本文件。
举例：
1、在 凌晨00:01运行
1 0 * * * /home/linrui/XXXX.sh

2、每个工作日23:59都进行备份作业。
59 11 * * 1,2,3,4,5 /home/linrui/XXXX.sh   
或者如下写法：
59 11 * * 1-5 /home/linrui/XXXX.sh

3、每分钟运行一次命令
*/1 * * * * /home/linrui/XXXX.sh

4、每个月的1号 14:10 运行
10 14 1 * * /home/linrui/XXXX.sh

# 定时任务的日志可以在
/var/log/cron中查看
```

crontab的弊端：

```shell
# crontab运行自定义脚本时，可能是由于没有一些初始化的环境变量，导致很多命令执行不了，例如下面的就执行不了：
pids=`jps |grep YarnChild | awk '{print $1}'`
# 没搞清楚是为啥执行不了，猜是由于没有环境变量，找不到jps或者其他原因，有个比较坑的地方，就是他没有报错信息，你也不知道执行没有
# 可以通过/var/log/cron查看，确实是执行了，但是没有输出。。命令执行失败了没有报错。。
```

于是换个定时思路，写个cron.sh，死循环，每次执行完采集脚本之后，sleep 10min。这不是完美解决！

```shell
while [ 1 ]
do
	./collect.sh
	sleep 10m
done
```

下面是采集脚本 collect.sh

```shell
DATE=$(date +%Y-%m-%d-%H-%M-%s)
# 拿到YarnChild的id集合
pids=`jps |grep YarnChild | awk '{print $1}'`
for pid in $(pid[@])
do
  # 存在进程再建目录
	mkdir $DATE
	jmap -heap $pid >> $DATE/heap
	jmap -histo $pid >> $DATE/histo
	jstack $pid >> $DATE/stack
	jstat -gc $pid >> $DATE/gc
	jinfo -flags $pid >> $DATE/flags
	
	# break 跳出循环，这里的意思是只采集一个YarnChild，因为map任务的配置，运行情况都差不多，只选一个就可以了
	break
done
```

给权限+后台运行定时脚本

```shell
chmod +x *sh
bash cron.sh &
```

每汁汁，下班！

## 调优策略

1、充分利用集群资源

首先我使用jmap打印了map程序的堆内存，发现设置的很小，远远没有将集群的内存利用起来。

通过下面的名称设置，可以看[官网Memory Management部分](https://hadoop.apache.org/docs/stable/hadoop-mapreduce-client/hadoop-mapreduce-client-core/MapReduceTutorial.html#Shuffle.2FReduce_Parameters)

```
mapreduce.{map|reduce}.memory.mb
```

2、根据mapreduce特点，优化业务代码的实现逻辑

之前的逻辑：

通过HBase源码中提供的TableMapReduceUtil工具类中的initTableReducerJob和initTableMapperJob可以快速方便的实现基于HBase表的mapreduce任务。通过工具类的init方法，可以将Mapper的输入设置为HBase表，将Reducer的输出设置为HBase表。

业务需要遍历数据表，拿到每一个数据表的值，计算他的二级索引的rowkey、列值。然后查询索引表。如果索引表中存在计算出来的值，说明这个数据没问题，反之就会存在4种情况，都是有问题的。我把这些有问题的情况存储在自定义的Record类中，传递给Reducer做合并。这个Record类需要实现Writable接口，实现write（）和readFields（）方法，用于进行序列化和反序列化。

map传给reduce的key-value为NullWritable和Record类，key统一设置为NullWritable是因为想让所有的结果都由一个reduce处理。这样reduce输出的表结果也是唯一的。

通过jmap -histo 我发现在reduce阶段，Record类占了20个G，并且还在增加，于是解决优化一下业务逻辑。

优化后的逻辑：

其实Record类可以去掉，reduce的value其实不需要传任何东西。我把Map传递的key-value改为ByteWritable和NullWritable。key值为一个byte，有效值为1到5，分别代表一个正常情况和四个异常情况。根据这五种情况进行聚合，这样value的唯一意义就在于占位了。通过计算reduce接收的values的长度（迭代器遍历，每个值都是null，我们只关心他的长度），来得到总的记录的数量。

而NullWritable每次反序列化出来其实都是同一个对象，大大减少了内存占用。



## [理解官网](https://hadoop.apache.org/docs/stable/hadoop-mapreduce-client/hadoop-mapreduce-client-core/MapReduceTutorial.html)

#### Mapper

Mapper将一对key-value映射为一组（0个、1个或多个）key-value集合

#### How Many Maps

Map数量通常取决于输入文件的大小、输入文件的blocks数量

正常的并行度为10～100个map。尽管对于cpu负载低的任务可以设置到300个map，但是不建议map Task的运行时间少于1分钟，因为这样的话创建map的开销就大于实际运行的开销了

因此10TB的数据，每个block为128MB，则有82000个maps

map数量可通过Configuration.set(`MRJobConfig.NUM_MAPS`, int) 设置(which only provides a hint to the framework) is used to set it even higher.

#### Reducer

Reducer将一组共享同一key的一组值，缩减为更小的一个集合

Reducer有三个主要的过程：

- shuffle

  reducer的输入就是已经排好序的mapper的输出，在这个阶段，框架通过http获取相关分区（relevant partition）的mapper的输出

- sort

  这一阶段框架将reducer的输入按key分组（groups），这时因为可能有不同mapper产生了相同的key

  shuffle和sort同时进行；当mapper的输出被获取到，他们就被合并（merged）了

- secondary sort

  如果需要自定义排序方式，可以通过[Job.setGroupingComparatorClass(Class)](https://hadoop.apache.org/docs/stable/api/org/apache/hadoop/mapreduce/Job.html) 设置

- reduce

  

#### How Many Reducer

reduces的数量通过[Job.setNumReduceTasks(int)](https://hadoop.apache.org/docs/stable/api/org/apache/hadoop/mapreduce/Job.html)设置

The right number of reduces seems to be `0.95` or `1.75` multiplied by (<*no. of nodes*> * <*no. of maximum containers per node*>).

就是说reduce的数量最好是0.95或1.75*（节点数量 * 容器最多的节点中容器的数量）

With `0.95` all of the reduces can launch immediately and start transferring map outputs as the maps finish. With `1.75` the faster nodes will finish their first round of reduces and launch a second wave of reduces doing a much better job of load balancing.



#### Partitioner

Partitioner对键空间进行分区。Partitioner控制中间映射输出的键的分区。键(或键的子集)用于派生分区，通常通过散列函数。分区总数与作业的reduce任务数相同。因此，它控制了m个reduce任务中的哪个，中间键(以及记录)被发送到哪个reduce任务。HashPartitioner是默认的Partitioner。



#### Counter

Counter是MapReduce应用程序报告其统计数据的工具。Mapper和Reducer的实现可以使用Counter来报告统计数据。Hadoop MapReduce捆绑了一个通常有用的映射器、reducer和分区程序库。



## 源码阅读

源码比较多，一点一点看

### Reduce

map传给reduce一个key、values。这个values是一个迭代器，整合了所有key值相同的结果。

疑问：我其实想搞清楚这些结果是存在内存中还是存在磁盘上的。为什么这里用了迭代器，而不是一个List，好处在哪里？我个人感觉应该是为了将一部分结果放在磁盘上，所以搞了这种复杂的结构。

这个values实际上是ReduceContextImpl类中的一个内部类ValueIterable。里面存了一个iterator，这个迭代器是一个ValueIterator，也是ReduceContextImpl类中的一个内部类。

Tips：在使用idea调试时，内部类中有一个 `this$0`的变量，它是指内部类所隶属的类。

观察ValueIterator的next方法，发现数据有两个来源

1、BackupStore（从缓存拿）

hasNext方法中，segmentList中拿一个seg出来，它是由一个reader和一个key组成的，如果reader读不出来东西了，就相当于没有nextValue了

```java
Segment<K,V> seg = segmentList.get(readSegmentIndex);
    // Mark the current position. This would be set to currentKVOffset
    // when the user consumes this record in next(). 
    nextKVOffset = (int) seg.getActualPosition();
    if (seg.nextRawKey()) {
      currentKey = seg.getKey();
      seg.getValue(currentValue);
      hasMore = true;
      return true;
    } else {
      if (!seg.inMemory()) {
        seg.closeReader();
      }
    }
```

segmentList在createInDiskSegment()和createInMemorySegment()中初始化

这两个方法在reset中被调用

```java
if (!inReset) {
      if (fileCache.isActive) {
        fileCache.createInDiskSegment();
      } else {
        memCache.createInMemorySegment();
      }
    } 
```

2、input（直接读，ReduceContextImpl中的成员变量）

​	input读出来的是一个DataInputBuffer，用于初始化ReduceContextImpl的buffer，而这个buffer可以初始化keyDeserializer，keyDeserializer可以将buffer内容反序列化出来。数据来源实际上就是input，里面存储了序列化的buffer。下面是得到key的例子，value也同理。

```java
DataInputBuffer nextKey = input.getKey();
currentRawKey.set(nextKey.getData(), nextKey.getPosition(), 
                  nextKey.getLength() - nextKey.getPosition());
buffer.reset(currentRawKey.getBytes(), 0, currentRawKey.getLength());
key = keyDeserializer.deserialize(key);

// value
DataInputBuffer nextVal = input.getValue();
buffer.reset(nextVal.getData(), nextVal.getPosition(), nextVal.getLength()
    - nextVal.getPosition());
value = valueDeserializer.deserialize(value);
```

​	这个input变量很关键，它是实现了RawKeyValueIterator的匿名内部类。在ReduceTask的runNewReduer中被定义。它是从上层方法ReduceTask的run（）方法的 `rIter = shuffleConsumerPlugin.run();`传过来的。

```java
		// wrap value iterator to report progress.
    final RawKeyValueIterator rawIter = rIter;
    rIter = new RawKeyValueIterator() {
      public void close() throws IOException {
        rawIter.close();
      }
      public DataInputBuffer getKey() throws IOException {
        return rawIter.getKey();
      }
      public Progress getProgress() {
        return rawIter.getProgress();
      }
      public DataInputBuffer getValue() throws IOException {
        return rawIter.getValue();
      }
      public boolean next() throws IOException {
        boolean ret = rawIter.next();
        reporter.setProgress(rawIter.getProgress().getProgress());
        return ret;
      }
    };
```

​	下面其实可以不用追了，这里只是记录一下。可以看到input实际上就是这个rawIter，通过next方法读取下一个数。通过调试发现这个rawIter是一个MergerQueue，MergeQueue的next方法，实际上使用了minSegment这个变量。

```java
public boolean next() throws IOException {
      if (size() == 0) {
        resetKeyValue();
        return false;
      }

      if (minSegment != null) {
        //minSegment is non-null for all invocations of next except the first
        //one. For the first invocation, the priority queue is ready for use
        //but for the subsequent invocations, first adjust the queue 
        adjustPriorityQueue(minSegment);
        if (size() == 0) {
          minSegment = null;
          resetKeyValue();
          return false;
        }
      }
      minSegment = top();
      long startPos = minSegment.getReader().bytesRead;
      key = minSegment.getKey();
      if (!minSegment.inMemory()) {
        //When we load the value from an inmemory segment, we reset
        //the "value" DIB in this class to the inmem segment's byte[].
        //When we load the value bytes from disk, we shouldn't use
        //the same byte[] since it would corrupt the data in the inmem
        //segment. So we maintain an explicit DIB for value bytes
        //obtained from disk, and if the current segment is a disk
        //segment, we reset the "value" DIB to the byte[] in that (so 
        //we reuse the disk segment DIB whenever we consider
        //a disk segment).
        minSegment.getValue(diskIFileValue);
        value.reset(diskIFileValue.getData(), diskIFileValue.getLength());
      } else {
        minSegment.getValue(value);
      }
      long endPos = minSegment.getReader().bytesRead;
      totalBytesProcessed += endPos - startPos;
      mergeProgress.set(Math.min(1.0f, totalBytesProcessed * progPerByte));
      return true;
    }
```

而top又是

```java
public final T top() {
    if (size > 0)
      return heap[1];
    else
      return null;
  }
```

所以rawIter实际遍历的是这个heap，那么heap是什么时候初始化的呢？在Merger类中的merge方法

```java
。。。
while (true) {
          //extract the smallest 'factor' number of segments  
          //Call cleanup on the empty segments (no key/value data)
          List<Segment<K, V>> mStream = 
            getSegmentDescriptors(numSegmentsToConsider);
          for (Segment<K, V> segment : mStream) {
            // Initialize the segment at the last possible moment;
            // this helps in ensuring we don't use buffers until we need them
            segment.init(readsCounter);
            long startPos = segment.getReader().bytesRead;
            boolean hasNext = segment.nextRawKey();
            long endPos = segment.getReader().bytesRead;
            
            if (hasNext) {
              startBytes += endPos - startPos;
              segmentsToMerge.add(segment);
              segmentsConsidered++;
            }
            else {
              segment.close();
              numSegments--; //we ignore this segment for the merge
            }
          }
          //if we have the desired number of segments
          //or looked at all available segments, we break
          if (segmentsConsidered == factor || 
              segments.size() == 0) {
            break;
          }
            
          numSegmentsToConsider = factor - segmentsConsidered;
        }
        
        //feed the streams to the priority queue
        initialize(segmentsToMerge.size());
        clear();
。。。
```

使用segmentsToMerge进行初始化，再往上追，来源在mStream = getSegmentDescriptors(numSegmentsToConsider);

```java
private List<Segment<K, V>> getSegmentDescriptors(int numDescriptors) {
      if (numDescriptors > segments.size()) {
        List<Segment<K, V>> subList = new ArrayList<Segment<K,V>>(segments);
        segments.clear();
        return subList;
      }
      
      List<Segment<K, V>> subList = 
        new ArrayList<Segment<K,V>>(segments.subList(0, numDescriptors));
      for (int i=0; i < numDescriptors; ++i) {
        segments.remove(0);
      }
      return subList;
    }
```

可以看到，实际来源是segments，再追

```java
public MergeQueue(Configuration conf, FileSystem fs, 
                      Path[] inputs, boolean deleteInputs, 
                      CompressionCodec codec, RawComparator<K> comparator,
                      Progressable reporter, 
                      Counters.Counter mergedMapOutputsCounter,
                      TaskType taskType) 
    throws IOException {
      this.conf = conf;
      this.fs = fs;
      this.codec = codec;
      this.comparator = comparator;
      this.reporter = reporter;
      
      if (taskType == TaskType.MAP) {
        considerFinalMergeForProgress();
      }
      
      for (Path file : inputs) {
        LOG.debug("MergeQ: adding: " + file);
        segments.add(new Segment<K, V>(conf, fs, file, codec, !deleteInputs, 
                                       (file.toString().endsWith(
                                           Task.MERGED_OUTPUT_PREFIX) ? 
                                        null : mergedMapOutputsCounter)));
      }
      
      // Sort segments on file-lengths
      Collections.sort(segments, segmentComparator); 
    }
```

segments是根据传入的Path[] inputs创建的

总结：代码看下来比较乱，总结一下。我追踪了reduce迭代器的数据来源，发现有两条线，一条是从BackupStore缓存中来，一种是直接读从input变量。两种方式有个共同点，他们最终读取的数据结构都是Segment。观察Segment.java，里面的构造方法有两类，一类的参数包含fs的路径，一类参数包含一个reader。也就是说数据来源有两类，一类是读取文件，一类是读取内存。





## 一些细节

```java
public void reduce(Text key, Iterable<IntWritable> values, 
                       Context context
                       ) throws IOException, InterruptedException {
//      Iterator i = values.iterator();
//      Spliterator s = values.spliterator();
//      s.getExactSizeIfKnown();
      int sum = 0;
      for (IntWritable val : values) {
        sum += val.get();
      }
      result.set(sum);
      context.write(key, result);
    }
```

以这个WordCount的Reduce为例，对values进行遍历，每次得到IntWritable val，其实是同一个对象，但里面的值会改变。这可能是mapreduce对内存做的优化。如果你用List把每次得到的val存起来，则会发现最后值都一样，都等于最后遍历出来的数值。
