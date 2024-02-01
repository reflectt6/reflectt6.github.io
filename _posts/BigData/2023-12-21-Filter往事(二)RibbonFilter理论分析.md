---
layout: page-with-sidebar-math
title:  "Filter往事(二)RibbonFilter理论分析"
date:   2023-12-21 10:47:03 +0800
author: reflectt6
categories: "大数据"
#permalink: 
mainTag: "大数据"
secondaryTag: "预研"
---

## [Ribbon Filter](https://arxiv.org/abs/2103.02515)

[论文](https://arxiv.org/pdf/2103.02515.pdf)

这论文比xor filter难懂的多，可以适当参考[知乎](https://zhuanlan.zhihu.com/p/565523164)大佬的分析

一个r位数，每个位可能的取值为0或者1: $$ \{0,1\}^r $$

异或: $$\bigoplus$$

同或: $$\bigodot$$



看知乎上说Ribbon Filter用的是高斯消元，而Rox Filter用的是Peeling，什么是Peeling？这个也是论文里面定义的，原文如下：

`Standard Xor filters use a fast solving process called peeling that limits their space efficiency to ≥ 1.22𝜆 bits per key7`

#### 论文概述

Section 2

简短的回顾了“static functions”，这个和java中的静态方法不是一个东西。作者想通过“static functions”定义一个过滤器

Section 3

分析Ribbon的构造算法；提出一个提升空间效率的优化“smash”；这些特性会导致，key数量上升的同时，空间或者时间开销上升。

Section 4

提出Homogeneous Ribbon filter，和Blocked bloom filter 共享许多参数。优点为：1、构造的成功性是可以保证的 2、扩展至任意的key数量，都是高效的

实现简单，但是要分析更多

Section 5

描述一些实验性的问题：

1、有效利用任意key数量的内存

2、高效查询的数据分布

3、高效满足hash需求

4、扩展标准Ribbon通过数据共享

Section 6

提出Balanced ribbon，通过连续ribbon，贪婪的加载balancing表。极大优化了“smash”的ribbon空间效率。

Section 7

更多实验验证。



#### Section3

从“静态方法（没啥实际含义，当个称呼就行）”构建ribbon过滤器

这个“静态方法”来自一篇[论文](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ESA.2019.39)，通过矩阵高效求解高斯消元问题。

ribbon过滤器实际上就是这个高斯方法的应用。

[论文PDF](https://drops.dagstuhl.de/storage/00lipics/lipics-vol144-esa2019/LIPIcs.ESA.2019.39/LIPIcs.ESA.2019.39.pdf)，挺离谱的，一个图都没有，全是字！

然后用图文给出了ribbon构造算法。

介绍了ribbon的一种错误场景（没看懂），以及解决思路。



#### Section4

HOMOGENEOUS RIBBON FILTERS是齐次ribbon过滤器的意思。就是线性代数里面齐次线性方程的齐次。也就是右侧的矩阵为0矩阵。齐次线性方程必有零解。
