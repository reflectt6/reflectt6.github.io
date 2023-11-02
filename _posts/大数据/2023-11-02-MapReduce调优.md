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

## 策略

1、充分利用集群资源

首先我使用jmap打印了map程序的堆内存，发现设置的很小，远远没有将集群的内存利用起来。

通过下面的名称设置，可以看[官网Memory Management部分](https://hadoop.apache.org/docs/stable/hadoop-mapreduce-client/hadoop-mapreduce-client-core/MapReduceTutorial.html#Shuffle.2FReduce_Parameters)

```
mapreduce.{map|reduce}.memory.mb
```

2、业务代码分批处理

由于业务原因本次reduce只设置了一个，在1T的数据量下，reduce数远小于map数量，这其实是不合理的。

所有的mapper的输入的key都是NullWritable，这样在reduce端，他接收的values会非常大，而我有用一个list存储了这个value的clone，由此导致了堆溢出，这里改进方式是，不要一下把values都存进List，我存储一部分，就合并一下，这样可以防止list内存爆炸。



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



