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
mkdir $DATE
for pid in $(pid[@])
do
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

TODO



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



