---
layout: page-with-sidebar-math
title:  "Filter往事(三)RibbonFilter开源实现"
date:   2023-12-21 10:47:03 +0800
author: reflectt6
categories: "大数据"
#permalink: 
mainTag: "大数据"
secondaryTag: "预研"
---

## [RocksDB](https://github.com/facebook/rocksdb)

RocksDB实现了Ribbon Filter，并且代码已经开源。

Facebook团队开发的key-value类型的存储库，采用c++开发，封装JNI给Java代码提供服务，但是Java的接口可能是滞后的（因为没时间同步，推荐开发者自发提PR）。

与HBase很类似，都是支持任意大小的键值对。区别在于HBase专注于大数据生态。而RocksDB支持各种存储硬件，包括纯内存，闪存、硬盘、远程存储等。

RocksDB详细文档在[github wiki](https://github.com/facebook/rocksdb/wiki)上

如何使用在[这里](https://github.com/facebook/rocksdb/wiki/Basic-Operations)

如何使用Java接口在[这里](https://github.com/facebook/rocksdb/wiki/RocksJava-Basics)

编译构建在[这里](https://github.com/facebook/rocksdb/blob/main/INSTALL.md)

### 源码分析（静态）

#### UT起手

从UT入手，关于ribbon filter的UT入口在ribbon_test.cc文件中。用到了gtest测试框架

gtest本质上做的事情就是将测试内容作为参数传递，例如测试的数据类型作为参数，测试数据作为参数

```c++
using TestTypesAndSettings = ::testing::Types<
    TypesAndSettings_Coeff128, TypesAndSettings_Coeff128Smash,
    TypesAndSettings_Coeff64, TypesAndSettings_Coeff64Smash,
    TypesAndSettings_Coeff64Smash0, TypesAndSettings_Coeff128_Homog,
    TypesAndSettings_Coeff128Smash_Homog, TypesAndSettings_Coeff64_Homog,
    TypesAndSettings_Coeff64Smash_Homog, TypesAndSettings_Result16,
    TypesAndSettings_Result32, TypesAndSettings_IndexSizeT,
    TypesAndSettings_Hash32, TypesAndSettings_Hash32_Result16,
    TypesAndSettings_KeyString, TypesAndSettings_Seed8,
    TypesAndSettings_NoAlwaysOne, TypesAndSettings_AllowZeroStarts,
    TypesAndSettings_Seed64, TypesAndSettings_Rehasher,
    TypesAndSettings_Rehasher_Result16, TypesAndSettings_Rehasher_Result32,
    TypesAndSettings_Rehasher_Seed64, TypesAndSettings_Rehasher32,
    TypesAndSettings_Rehasher32_Coeff64, TypesAndSettings_SmallKeyGen,
    TypesAndSettings_Hash32_SmallKeyGen, TypesAndSettings_Coeff32,
    TypesAndSettings_Coeff32Smash, TypesAndSettings_Coeff16,
    TypesAndSettings_Coeff16Smash>;
TYPED_TEST_CASE(RibbonTypeParamTest, TestTypesAndSettings);
```

TYPED_TEST_CASE应该是注册了测试的数据类型。

```c++
TYPED_TEST(RibbonTypeParamTest, CompactnessAndBacktrackAndFpRate) {
  IMPORT_RIBBON_TYPES_AND_SETTINGS(TypeParam);
  IMPORT_RIBBON_IMPL_TYPES(TypeParam);
  using KeyGen = typename TypeParam::KeyGen;
  using ConfigHelper =
      ROCKSDB_NAMESPACE::ribbon::BandingConfigHelper<TypeParam>;
  。。。。
```

注册完之后，下面对于RibbonTypeParamTest的测试应该就会将上面所有类型都跑一遍，也就是别看这只是一个UT，但实际上会测几十种类型，也是框架的能力所在。而CompactnessAndBacktrackAndFpRate应该类似Java UT中的case name。

既然找到了UT，下一步就是找Ribbon filter的实现。换位思考，如果我写了一个Ribbon filter 我会写什么样的UT来测？

​	1、Ribbon filter目的在节省内存空间，那么我一定要对比这个filter和bloom filter的占用空间

​	2、对比ribbon和bloom的构建时间。。（可能）

​	3、随机生成一下query，查看Fp rate(错误率)，并且和bloom对比

那再看下实际上有哪些测试内容，据我的测试TYPED_TEST会apply上面那注册的一堆类型，但是TEST不会，只会运行一次。

```c++
//1、测试各种类型
TYPED_TEST(RibbonTypeParamTest, CompactnessAndBacktrackAndFpRate) // 压缩率和错误率

TYPED_TEST(RibbonTypeParamTest, Extremes) // 极端情况？

// Not a real test, but a tool used to build APIs in ribbon_config.h
TYPED_TEST(RibbonTypeParamTest, FindOccupancy)

// Not a real test, but a tool to understand Homogeneous Ribbon
// behavior (TODO: configuration APIs & tests)
TYPED_TEST(RibbonTypeParamTest, OptimizeHomogAtScale) // 这玩意是理解Homogeneous Ribbon的工具？
```

关注的变量有哪些？分别对应算法中的什么值？

```c
TEST(RibbonTest, AllowZeroStarts) // 允许以0开头，那么是什么的开头呢？

TEST(RibbonTest, RawAndOrdinalSeeds) // 原始的种子 测试，种子是干什么的？ 生成Hash？

TEST(RibbonTest, PhsfBasic) // phsf是啥？
```

ok，这名字起的非常好，看似没啥用，实则一点用没有。

两个关键宏

```c++
IMPORT_RIBBON_TYPES_AND_SETTINGS(TypeParam);
IMPORT_RIBBON_IMPL_TYPES(TypeParam);
```

第一个宏可以得到ribbon filter关注的变量有哪些

```
CoeffRow -》系数矩阵的行
ResultRow —》结果矩阵的行
上面两个矩阵是为了求解solution矩阵

Index
Hash
Key
Seed

/* Some more additions */    
QueryInput
AddInput
kCoeffBits --》对应论文中的w

/* Export to algorithm */
kFirstCoeffAlwaysOne 
```

第二个宏，可以得到ribbon filter实现所需要的几个关键对象

```
using Hasher = ROCKSDB_NAMESPACE::ribbon::StandardHasher<TypesAndSettings>;
using Banding = ROCKSDB_NAMESPACE::ribbon::StandardBanding<TypesAndSettings>;    
using SimpleSoln = ROCKSDB_NAMESPACE::ribbon::InMemSimpleSolution<TypesAndSettings>;
using InterleavedSoln = ROCKSDB_NAMESPACE::ribbon::SerializableInterleavedSolution<TypesAndSettings>;
```

把上面这几个参数和对象搞明白ribbon filter基本上可以搞定

#### ribbon相关代码

从UT入手可以得到几个ribbon相关的代码文件

- ribbon_impl.h
- ribbon_alg.h
- ribbon_config.h

#### Hasher

`StandardHasher: A standard implementation of concepts RibbonTypes, PhsfQueryHasher, FilterQueryHasher, and BandingHasher from ribbon_alg.h.`



RibbonTypes, PhsfQueryHasher, FilterQueryHasher, and BandingHasher是依次继承过来的，在后面有解释

他们的实现在ribbon_alg.h中

关于 Hasher的注释，translated by chatGpt 3.5

```
这个实现在大多数实际情况下应该是合适的，因为它在各种设置下都能够“表现”良好，几乎没有改进的余地。在这个哈希函数中的关键功能是从一个适度的64位或者仅仅32位的哈希中生成CoeffRows、starts和（对于过滤器而言）ResultRows，这可能是150位甚至更多的数据，具有足够的均匀性和位独立性，以接近在FP率和紧凑性方面利用可用哈希信息“做到最好”的水平。（对于PHSF的实际目的，推荐使用64位并且足够。）

这个哈希函数的另一个特性是在将种子提供给TypesAndSettings::HashFn之前进行最小程度的“预混合”，以防该函数在仅按顺序迭代种子时无法提供足够独立的哈希值。 （例如，这可以解决RocksDB中使用的XXH3预览版本0.7.2存在的问题，即XXPH3或Hash64，以及RocksDB中使用的MurmurHash1，即Hash）。我们称这个预混合步骤将“序数种子”（我们按顺序迭代以找到解决方案的种子）转换为“原始种子”，在每次迭代中有更多的位发生变化。这种转换是一种易于逆转的轻量级混合，不适合单独进行哈希。这种方法的优势在于StandardHasher可以仅存储原始种子（例如64位），以实现快速查询时间，而从应用程序的角度来看，我们可以限制保存在元数据中的序数键数量（例如6位中的64个）。

默认构造函数将种子初始化为序数种子零，这与原始种子零相等。
```

#### Banding

```
tandardBanding: a canonical implementation of BandingStorage and BacktrackStorage, with convenience API for banding (solving with on-the-fly Gaussian elimination) with and without backtracking.
 
StandardBanding：是BandingStorage和BacktrackStorage的经典实现，提供了带有和不带有回溯的带宽（通过即时高斯消元求解）的便利API。
```

那么问题来了， BandingStorage和BacktrackStorage是什么？回溯的目的是什么？

replied by chat gpt：

```
BandingStorage和BacktrackStorage是与算法和数据结构相关的概念，通常在解决问题时用于存储和处理中间结果。

BandingStorage（带宽存储）：

定义： 用于在解决问题时存储和处理带宽的数据结构。
用途： 在某些算法中，带宽是指一组值或范围，用于描述问题的特定方面。BandingStorage通常用于存储这些带宽，并提供一种有效的方式进行操作和查询。
BacktrackStorage（回溯存储）：

定义： 用于在解决问题时存储和处理回溯信息的数据结构。
用途： 在问题解决过程中，有时需要回溯（即返回之前的状态）以尝试不同的路径或选择。BacktrackStorage用于记录在解决问题时所做的选择，以便在需要时能够回退到之前的状态，重新探索其他可能的解决方案。
这些概念通常与特定的算法或问题领域相关联，因此具体的实现和用途可能会根据上下文而异。在你提供的文本中，这些概念可能是用于某种解决方案的关键组件，涉及到带宽和回溯的存储和处理。
```



#### InMemSimpleSolution

```
 Implements concept SimpleSolutionStorage, mostly for demonstration
 purposes. This is "in memory" only because it does not handle byte
 ordering issues for serialization.
 
 
实现SimpleSolutionStorage概念，主要用于演示目的。这仅仅是“内存中”的，因为它不处理序列化的字节顺序问题。
```

那么问题来了，SimpleSolutionStorage是什么？这个chat gpt也不懂，开始分析了一波

```
SimpleSolutionStorage 是一个概念或者接口，用于表示一种存储解决方案的简单实现。根据提供的上下文，它可能是用于存储问题解决方案的数据结构或接口的一部分。

以下是对文本中提到的 SimpleSolutionStorage 的翻译：

实现了 SimpleSolutionStorage 概念，主要用于演示目的。这仅仅是“内存中”的，因为它不处理序列化的字节顺序问题。

这段文字表明 SimpleSolutionStorage 作为一个概念被实现，主要用于演示。它被描述为一种在内存中存储解决方案的简单实现，并且由于不涉及处理序列化的字节顺序问题，它被限定为“内存中”使用，即在内存中操作而不涉及外部存储或网络传输。

在具体的上下文中，SimpleSolutionStorage 的实现可能包括存储解决方案的数据结构，以及用于查询、更新或处理解决方案的相关方法。
```



#### SerializableInterleavedSolution

```
 Implements concept InterleavedSolutionStorage always using little-endian
 byte order, so easy for serialization/deserialization. This implementation
 fully supports fractional bits per key, where any number of segments
 (number of bytes multiple of sizeof(CoeffRow)) can be used with any number
 of slots that is a multiple of kCoeffBits.

 The structure is passed an externally allocated/de-allocated byte buffer
 that is optionally pre-populated (from storage) for answering queries,
 or can be populated by BackSubstFrom.
 
实现InterleavedSolutionStorage概念，始终使用小端字节顺序，因此便于序列化和反序列化。这个实现完全支持每个键的分数位，其中可以使用任意数量的段（字节数是CoeffRow的sizeof倍数）以及任意数量的插槽（是kCoeffBits的倍数）。

该结构接收一个外部分配/释放的字节缓冲区，可选择地预先填充（从存储中）以回答查询，或者可以由BackSubstFrom填充。
```

那么问题来了，InterleavedSolutionStorage是什么？

根据分析，interleaved是一种高效的存储格式，类似列式存储。

上面提出的问题基本可以在alg文件的注释中找到答案，下面会对alg文件进行分析。

#### ribbon_alg.h

核心算法的通用版本，聚焦核心细节

```
ribbon是一个完美的静态hash方法，结合一下优点
1、布尔线性系统
2、增量，即时的高斯消元法
3、高效的存储方式
```



#### ribbon_impl.h



#### PHSF

如果我没猜错的话，应该是`A Perfect Hash Static Function`的缩写，作用是

`A Perfect Hash Static Function is a data structure representing a map from anything hashable (a "key") to values of some fixed size.`

更重要的是：

`Crucially, it is allowed to return garbage values for anything not in the original set of map keys`

而且构建好之后，它的entries就不能再增加或者删除了



#### entry

猜测entry就是构建过滤器用的row



#### MWHC

又称为Xor Filter



#### Ribbon PHSF Construction

```
    C    *    S    =    R
 (n x m)   (m x b)   (n x b)
 where C = coefficients, S = solution, R = results
 and solving for S given C and R.
 
 这个m也叫solt数
```

根据注释，n越大，则有解的可能性越小。解就是指S矩阵。

```
// 映射关系
GetStart() 对应论文中的s(x)
kCoeffBits也称为r 对应论文中的w宽度，是一个固定宽度
GetCoeffRow() 对应论文中映射为w宽度的hash函数c(x)，一般是以1开头的

m/n或r越大，有解的可能性越大
```

rocksdb提供的数据：当keys处于10～100k时，r选择128有很高的性价比。



#### Banding

banding是一个过程，应该是指将系数矩阵化简为行阶梯矩阵的过程，由于行阶梯矩阵由宽度为r的band组成，因此也叫“条带化”



#### "incremental" and "on-the-fly"

banding算法就如同论文中伪代码展示的一样。

因为可以不断添加，算法拥有“增量”特点。

由于在处理每个输入后，我们在处理到目前为止的所有输入时“完成”了，算法拥有“及时”的特点。

这就是"incremental" and "on-the-fly"含义。

```
 We call our banding algorithm "incremental" and "on-the-fly" because
 (like hash table insertion) we are "finished" after each input
 processed, with respect to all inputs processed so far. Although the
 band matrix is an intermediate step to the solution structure, we have
 eliminated intermediate steps and unnecessary data tracking for
 banding.
 
 我们将我们的带状算法称为“增量”和“即时”的，因为（就像哈希表插入一样）在处理每个输入后，我们在处理到目前为止的所有输入时“完成”了。尽管带状矩阵是解结构的一个中间步骤，但我们已经消除了带状的中间步骤和不必要的数据跟踪。
```

由于这个算法不会覆盖原有的行，而是对新的行赋值，所以拥有可回溯性（backtrackable）。

来自注释的数据：当C矩阵的填充度到达90%～95%之后，解决冲突会占据主要的构建时间，于是考虑使用更高的m/n比率。rocksdb建议m/n的比例在1.2比较合适，因为Bloom过滤器是1.5，这个比例比bloom要低，并且速度也会提升。

```
Back-substitution from an upper-triangular boolean band matrix is
 especially fast and easy. All the memory accesses are sequential or at
 least local, no random. If the number of result bits (b) is a
 compile-time constant, the back-substitution state can even be tracked
 in CPU registers. Regardless of the solution representation, we prefer
 column-major representation for tracking back-substitution state, as
 r (the band width) will typically be much larger than b (result bits
 or columns), so better to handle r-bit values b times (per solution
 row) than b-bit values r times.
 
从一个上三角的布尔带状矩阵进行回代法是特别快速且容易的。所有内存访问都是顺序的或至少是局部的，没有随机访问。如果结果位数（b）是一个编译时常量，回代法的状态甚至可以在CPU寄存器中跟踪。无论解的表示方式如何，我们更喜欢使用列优先的表示方式来跟踪回代法的状态，因为 r（带宽）通常会比 b（结果位或列）大得多，因此最好处理 r 位值 b 次（每个解的行）而不是 b 位值 r 次。

总结：这里的r是指论文中的w，他比论文中的b(x)一般要大的多，所以一般采用列式存储。
```



#### scalability

ribbon的可扩展性表现在r、n、m的值支持自定义，理论上可以是任意值。

#### slot

也就是系数矩阵（n*m）的m，对应论文里面的m（论文里给的图n=m）



#### ribbon核心算法

```
 +-----------+     +---+     +-----------------+
 | AddInputs | --> | H | --> | BandingStorage  |
 +-----------+     | a |     +-----------------+
                   | s |             |
                   | h |      Back substitution
                   | e |             V
 +-----------+     | r |     +-----------------+
 | Query Key | --> |   | >+< | SolutionStorage |
 +-----------+     +---+  |  +-----------------+
                          V
                     Query result
                     
                     
貌似Back substitution就是解出Solution的解法，这个解法和SolutionStorage强相关
```

##### RibbonTypes概念

CoeffRow：一个r-bit的系数向量 ,至于r：

```
r (or kCoeffBits) is taken to be sizeof(CoeffRow) * 8
```

ResultRow：

```
An unsigned integer type big enough to hold a result row (b bits, or number of solution/result columns).
```

Index：无符号整数，表示solution矩阵中的行号

```
An unsigned integer type sufficient for representing the number of rows in the solution structure,
```



##### PhsfQueryHasher extend RibbonTypes概念

Key：

```
Type for a lookup key, which is hashable.
```

Hash：

```
Type for hashed summary of a Key. uint64_t is recommended.
```

函数GetHash(const Key &)：

```
Compute a hash value summarizing a Key
```

函数GetStart(Hash, Index num_starts):

```
给一个hash值和一个可以开始r-bit的位置（m-r + 1），返回这个Hash应该开始的位置，也就是论文中的s()

GetNumStart() 是给出start的边界，因为start 属于 [0, num_start]的范围
而num_start就是论文中的 m-w+1，也就是代码中的m - r + 1
```

函数GetCoeffRow(Hash):给定一个哈希值，返回与之关联的 r 位系数序列,一般这个序列要大于提供的Hash值

```
Given a hash value, return the r-bit sequence of coefficients to
    associate with it. It's generally OK if
      sizeof(CoeffRow) > sizeof(Hash)
    as long as the hash itself is not too prone to collisions for the
    applications and the CoeffRow is generated uniformly from
    available hash data, but relatively independent of the start.

    Must be non-zero, because that's required for a solution to exist
    when mapping to non-zero result row. (Note: BandingAdd could be
    modified to allow 0 coeff row if that only occurs with 0 result
    row, which really only makes sense for filter implementation,
    where both values are hash-derived. Or BandingAdd could reject 0
    coeff row, forcing next seed, but that has potential problems with
    generality/scalability.)
    
    
给定一个哈希值，返回与之关联的 r 位系数序列。通常，如果 sizeof(CoeffRow) > sizeof(Hash)，只要哈希本身不太容易发生冲突对于应用程序，并且 CoeffRow 是从可用的哈希数据均匀生成的，而相对独立于起始位置，那就没问题。必须是非零的，因为这对于映射到非零结果行时需要存在解。（注意：BandingAdd 可能会被修改以允许 0 系数行，如果只有在 0 结果行的情况下发生，这对于过滤器实现才有意义，因为这两个值都是哈希派生的。或者 BandingAdd 可以拒绝 0 系数行，强制使用下一个种子，但这可能存在通用性/可扩展性的潜在问题。）
```

##### FilterQueryHasher extends PhsfQueryHasher概念

函数GetResultRowFromHash(Hash)：应该是查询时候用的，通过Hash得到结果行

##### BandingHasher extends FilterQueryHasher概念

AddInput：目前不太理解

```
For a filter, this will generally be the same as Key.
For a general PHSF, it must either
(a) include a key and a result it maps to (e.g. in a std::pair), or
(b) GetResultRowFromInput looks up the result somewhere rather than
extracting it.

对过滤器而言，一般他和key是一个意思
对于一般的PHSF，
要么 1、包含key和他对应的result
要么 2、GetResultRowFromInput从某地找到result，而不是提取他
```

函数GetHash(const AddInput &)：

不是提取从AddInput提取Key，而是获取AddInput的一部分（这一部分是Key）的Hash。如果AddInput和Key相同，那什么特别要注意的了。

函数ResultRow GetResultRowFromInput(const AddInput &)：

```
对于非filter的PHSF，它提取或查找与输入相关的结果行
对于Filter的PHSF，它返回0
```

kFirstCoeffAlwaysOne：

```
Whether the solver can assume the lowest bit of GetCoeffRow is always 1. When true, it should improve solver efficiency slightly.

求解器是否可以假定 GetCoeffRow 的最低位始终为1。当为true时，这应该会略微提高求解器的效率。
```

##### BandingStorage extends RibbonTypes概念

bool UsePrefetch() const：

```
Tells the banding algorithm to prefetch memory associated with
    the next input before processing the current input. Generally
    recommended iff the BandingStorage doesn't easily fit in CPU
    cache.

告诉带状算法在处理当前输入之前预取与下一个输入相关联的内存。通常建议在带状存储不容易适应 CPU 缓存的情况下使用。
```

void Prefetch(Index i) const：

```
Prefetches (e.g. __builtin_prefetch) memory associated with a slot index i.

预取（例如使用 __builtin_prefetch）与槽索引 i 相关联的内存。
```

void LoadRow(Index i, CoeffRow *cr, ResultRow *rr, bool for_back_subst) const：
void StoreRow(Index i, CoeffRow cr, ResultRow rr)：

```
Load or store CoeffRow and ResultRow for slot index i.
    (Gaussian row operations involve both sides of the equation.)
    Bool `for_back_subst` indicates that customizing values for
    unconstrained solution rows (cr == 0) is allowed.

加载或存储与槽索引 i 相关的 CoeffRow 和 ResultRow。（高斯行操作涉及方程的两侧。）布尔值 for_back_subst 表示允许为无约束解行（cr == 0）自定义值。
```

Index GetNumStarts() const：

```
Returns the number of columns that can start an r-sequence of
    coefficients, which is the number of slots minus r (kCoeffBits)
    plus one. (m - r + 1)

返回可以开始一个 r-系数序列的列数，即槽的数量减去 r（kCoeffBits）再加一。（m - r + 1）
```



##### BacktrackStorage extends RibbonTypes

bool UseBacktrack() const：

```
If false, backtracking support will be disabled in the algorithm.
    This should preferably be an inline compile-time constant function.
    
   
如果为 false，则算法中将禁用回溯支持。最好将其设置为内联的编译时常量函数。
```

void BacktrackPut(Index i, Index to_save)：

```
Records `to_save` as the `i`th backtrack entry

记录 to_save 作为第 i 个回溯条目。
```

Index BacktrackGet(Index i) const：

```
Recalls the `i`th backtrack entry

回溯到第 i 个回溯条目。
```



##### 矩阵运算

bool BandingAddRange（5个参数）：*关键*

核心算法，下面的两个ADD方法最终都是调用了这个5个参数的方法

```
 Adds a range of entries to BandingStorage returning true if successful
 or false if solution is impossible with current hasher (and presumably
 its seed) and number of "slots" (solution or banding rows). (A solution
 is impossible when there is a linear dependence among the inputs that
 doesn't "cancel out".) Here "InputIterator" is an iterator over AddInputs.

 If UseBacktrack in the BacktrackStorage, this function call rolls back
 to prior state on failure. If !UseBacktrack, some subset of the entries
 will have been added to the BandingStorage, so best considered to be in
 an indeterminate state.
 
 
向BandingStorage添加一个条目范围，如果成功则返回true，如果使用当前的哈希函数（以及其可能的种子）和“槽位”（解或带状行）无法找到解则返回false（当输入之间存在线性相关性且无法“取消掉”时，解就无法找到）。这里的“InputIterator”是一个在AddInputs上的迭代器。

如果BacktrackStorage中的UseBacktrack为true，在失败时此函数调用将回滚到先前的状态。如果UseBacktrack为false，则BandingStorage中将添加一些条目的子集，因此最好将其视为不确定状态。
```

bool BandingAddRange(BandingStorage *bs, const BandingHasher &bh, InputIterator begin, InputIterator end)：

```
 Adds a range of entries to BandingStorage returning true if successful
 or false if solution is impossible with current hasher (and presumably
 its seed) and number of "slots" (solution or banding rows). (A solution
 is impossible when there is a linear dependence among the inputs that
 doesn't "cancel out".) Here "InputIterator" is an iterator over AddInputs.

 On failure, some subset of the entries will have been added to the
 BandingStorage, so best considered to be in an indeterminate state.
 
 
向BandingStorage添加一个条目范围，如果成功则返回true，如果使用当前的哈希函数（以及其可能的种子）和“槽位”（解或带状行）无法找到解则返回false（当输入之间存在线性相关性且无法“取消掉”时，解就无法找到）。这里的“InputIterator”是一个在AddInputs上的迭代器。

在失败时，BandingStorage中将添加一些条目的子集，因此最好将其视为不确定状态。
```

bool BandingAdd()：

```
Adds a single entry to BandingStorage (and optionally, BacktrackStorage),
 returning true if successful or false if solution is impossible with
 current hasher (and presumably its seed) and number of "slots" (solution
 or banding rows). (A solution is impossible when there is a linear
 dependence among the inputs that doesn't "cancel out".)

 Pre- and post-condition: the BandingStorage represents a band matrix
 ready for back substitution (row echelon form except for zero rows),
 augmented with result values such that back substitution would give a
 solution satisfying all the cr@start -> rr entries added.



向BandingStorage（和可选的BacktrackStorage）添加单个条目，如果成功则返回true，如果使用当前的哈希函数（以及其可能的种子）和“槽位”（解或带状行）无法找到解则返回false（当输入之间存在线性相关性且无法“取消掉”时，解就无法找到）。

前置和后置条件：BandingStorage表示一个准备进行回代替换的带状矩阵（行梯阵形式，除了零行），通过增加满足所有添加的 cr@start -> rr 条目的解的结果值扩充。
```



#### 两种存储方式

回带计算Solution由Storage决定和实现

`Back-substitution and query algorithms unfortunately depend on some details of data layout in the final data structure ("solution"). Thus, there is no common SolutionStorage covering all the reasonable possibilities. 回代替换和查询算法不幸地依赖于最终数据结构（“解”）中的一些细节。因此，没有一个通用的SolutionStorage涵盖所有合理的可能性。`

也就是说回带和查询算法都需要依赖数据的存储结构，下面是两种数据存储方式

##### SimpleSolutionStorage extends RibbonTypes

```
SimpleSolutionStorage is for a row-major storage, typically with no
unused bits in each ResultRow. This is mostly for demonstration
purposes as the simplest solution storage scheme. It is relatively slow
for filter queries.

SimpleSolutionStorage 用于行主存储，通常每个 ResultRow 中没有未使用的位。这主要是为了演示目的，作为最简单的解决方案存储方案。对于过滤查询而言，它相对较慢。
```

void PrepareForNumStarts(Index num_starts) const：

```
This is called at the beginning of back-substitution for the
    solution storage to do any remaining configuration before data
    is stored to it. If configuration is previously finalized, this
    could be a simple assertion or even no-op. Ribbon algorithms
    only call this from back-substitution, and only once per call,
    before other functions here.

这在回代解题的开始时调用，用于在数据存储到解决方案存储之前执行任何剩余的配置。如果配置已经最终确定，这可能是一个简单的断言，甚至是空操作。Ribbon 算法只在回代解题中调用此函数，每次调用只调用一次，在调用其他函数之前。
```

Index GetNumStarts() const：

```
Must return num_starts passed to PrepareForNumStarts, or the most
recent call to PrepareForNumStarts if this storage object can be
reused. Note that num_starts == num_slots - kCoeffBits + 1 because
there must be a run of kCoeffBits slots starting from each start.

必须返回传递给 PrepareForNumStarts 的 num_starts，或者如果此存储对象可以被重用，则返回最近一次调用 PrepareForNumStarts。请注意，num_starts == num_slots - kCoeffBits + 1，因为必须有一个从每个 start 开始的 kCoeffBits 槽的运行。
```

ResultRow Load(Index slot_num) const：

```
Load the solution row (type ResultRow) for a slot
```

void Store(Index slot_num, ResultRow data)：

```
Store the solution row (type ResultRow) for a slot
```



##### InterleavedSolutionStorage extends RibbonTypes

```
 InterleavedSolutionStorage is row-major at a high level, for good
 locality, and column-major at a low level, for CPU efficiency
 especially in filter queries or relatively small number of result bits
 (== solution columns). The storage is a sequence of "blocks" where a
 block has one CoeffRow-sized segment for each solution column. Each
 query spans at most two blocks; the starting solution row is typically
 in the row-logical middle of a block and spans to the middle of the
 next block. (See diagram below.)

 InterleavedSolutionStorage supports choosing b (number of result or
 solution columns) at run time, and even supports mixing b and b-1 solution
 columns in a single linear system solution, for filters that can
 effectively utilize any size space (multiple of CoeffRow) for minimizing
 FP rate for any number of added keys. To simplify query implementation
 (with lower-index columns first), the b-bit portion comes after the b-1
 portion of the structure.
 
InterleavedSolutionStorage 在高层次上是行主序的，以提高局部性，并且在低层次上是列主序的，特别是在过滤查询或结果位数相对较小（== 解决方案列）的情况下，以提高 CPU 效率。存储是一系列 "块"，其中一个块对应每个解决方案列一个 CoeffRow 大小的段。每个查询最多涉及两个块；起始解决方案行通常位于块的逻辑行中间，并跨足到下一个块的中间位置。（见下面的示意图。）

InterleavedSolutionStorage 支持在运行时选择 b（结果或解决方案列的数量），甚至支持在单个线性系统解决方案中混合 b 和 b-1 解决方案列，以适应可以有效利用任意大小空间（CoeffRow 的倍数）以最小化任意数量的添加关键字的 FP 率的过滤器。为了简化查询实现（以较低索引的列优先），b 位的部分位于结构的 b-1 部分之后。



示意图（=== 标记逻辑块边界；b=4；### 是由跨越 b-1 到 b 边界的查询使用的数据，每个 Segment 具有类型 CoeffRow）：
Diagram (=== marks logical block boundary; b=4; ### is data used by a
 query crossing the b-1 to b boundary, each Segment has type CoeffRow):
 +======================+
 | S e g m e n t  col=0 |
 +----------------------+
 | S e g m e n t  col=1 |
 +----------------------+
 | S e g m e n t  col=2 |
 +======================+
 | S e g m e n #########|
 +----------------------+
 | S e g m e n #########|
 +----------------------+
 | S e g m e n #########|
 +======================+ Result/solution columns: above = 3, below = 4
 |#############t  col=0 |
 +----------------------+
 |#############t  col=1 |
 +----------------------+
 |#############t  col=2 |
 +----------------------+
 | S e g m e n t  col=3 |
 +======================+
 | S e g m e n t  col=0 |
 +----------------------+
 | S e g m e n t  col=1 |
 +----------------------+
 | S e g m e n t  col=2 |
 +----------------------+
 | S e g m e n t  col=3 |
 +======================+

 InterleavedSolutionStorage will be adapted by the algorithms from
 simple array-like segment storage. That array-like storage is templatized
 in part so that an implementation may choose to handle byte ordering
 at access time.
 
InterleavedSolutionStorage 将被算法从简单的类似数组的段存储中进行调整。该类似数组的存储在一定程度上是模板化的，以便实现可以选择在访问时处理字节顺序。
```



void PrepareForNumStarts(Index num_starts) const：

```
This is called at the beginning of back-substitution for the
solution storage to do any remaining configuration before data
is stored to it. If configuration is previously finalized, this
could be a simple assertion or even no-op. Ribbon algorithms
only call this from back-substitution, and only once per call,
before other functions here.

在解代替换的开始时调用此函数，用于在数据存储到解决方案存储之前执行任何剩余的配置。如果配置已经最终确定，这可能是一个简单的断言，甚至是空操作。Ribbon 算法只在解代替换时调用此函数，每次调用只调用一次，在调用此处的其他函数之前。
```

Index GetNumStarts() const：

```
Must return num_starts passed to PrepareForNumStarts, or the most
recent call to PrepareForNumStarts if this storage object can be
reused. Note that num_starts == num_slots - kCoeffBits + 1 because
there must be a run of kCoeffBits slots starting from each start.

必须返回传递给 PrepareForNumStarts 的 num_starts，或者如果此存储对象可以被重用，则返回最近一次调用 PrepareForNumStarts。请注意，num_starts == num_slots - kCoeffBits + 1，因为必须有一个从每个 start 开始的 kCoeffBits 槽的运行。
```

Index GetUpperNumColumns() const：

```
The larger number of solution columns used (called "b" above).
使用的解决方案列数较大的数字（上面称为“b”）。
```

Index GetUpperStartBlock() const：

```
If returns > 0, then block numbers below that use
    GetUpperNumColumns() - 1 columns per solution row, and the rest
    use GetUpperNumColumns(). A block represents kCoeffBits "slots",
    where all but the last kCoeffBits - 1 slots are also starts. And
    a block contains a segment for each solution column.
    An implementation may only support uniform columns per solution
    row and return constant 0 here.

如果返回大于 0，则以下的块号使用每个解决方案行 GetUpperNumColumns() - 1 列，而其余的使用 GetUpperNumColumns()。一个块表示 kCoeffBits 个“槽位”，其中除了最后的 kCoeffBits - 1 个槽位外，所有槽位也是开始。一个块包含每个解决方案列的一个段。一个实现可能只支持每个解决方案行的均匀列，并在这里返回常量0。
```

Index GetNumSegments() const：

```
### "Array of segments" portion of API ###
    The number of values of type CoeffRow used in this solution
    representation. (This value can be inferred from the previous
    three functions, but is expected at least for sanity / assertion
    checking.)

API 的 "数组段" 部分
在此解决方案表示中使用的 CoeffRow 类型的值的数量。（尽管此值可以从前三个函数中推断出来，但至少在进行健全性/断言检查时应提供。）
```

CoeffRow LoadSegment(Index segment_num) const：

```
Load an entry from the logical array of segments
```

void StoreSegment(Index segment_num, CoeffRow data)：

```
Store an entry to the logical array of segments
```

#### 基于两种存储方式，对应的回代和查询

##### SimpleSolutionStorage

方法SimpleBackSubst（）：从 BandingStorage 生成解到 SimpleSolutionStorage 的解代替换。

方法SimpleQueryHelper（）：在 SimpleSolutionStorage 中查询一个已经哈希的关键字的通用功能。

方法SimplePhsfQuery（）：从 SimpleSolutionStorage 中进行一般的 PHSF 查询，查询一个关键字。

方法SimpleFilterQuery（）：

##### InterleavedSolutionStorage

方法BackSubstBlock（）：回代方法InterleavedBackSubst的helper方法

方法InterleavedBackSubst（）：回代方法

方法InterleavedPrepareQuery（）：Prefetch memory for a key in InterleavedSolutionStorage.

方法InterleavedPhsfQuery（）：从 InterleavedSolutionStorage 中进行的一般 PHSF 查询，使用来自 InterleavedPrepareQuery 的查询关键字的数据。

方法InterleavedFilterQuery（）：从 InterleavedFilterQuery 进行的关键字过滤查询。



函数SimpleBackSubst（）：

实现回代解题



#### 代码结构分析

矩阵形态

```
    C    *    S    =    R
 (n x m)   (m x b)   (n x b)
 where C = coefficients, S = solution, R = results
 and solving for S given C and R.
 
 这个m也叫solt数
```

概念模型

```
 +-----------+                      +---+                 +-----------------+
 | AddInputs | ----BandingHasher--> | H | --------------> | BandingStorage  | 我理解应该是处理C矩阵和R矩阵
 +-----------+                      | a |                 +-----------------+
                                    | s |                         |
                                    | h |                  Back substitution
                                    | e |                         V
 +-----------+  PhsfQueryHasher     | r |                 +-----------------+  回代计算S矩阵
 | Query Key | -FilterQueryHasher-> |   | >+++++++++++++< | SolutionStorage | （SimpleSolutionStorage）
 +-----------+                      +---+        |        +-----------------+ （InterleavedSolutionStorage）
                                                 V
                                            Query result
```

代码实现模型

```
 +-----------+                      +---+                 +-----------------+ 我理解应该是处理C矩阵和R矩阵
 | AddInputs | ---StandardHasher--->| H | --------------> | BandingStorage  | StandardBanding
 +-----------+                      | a |                 +-----------------+
                                    | s |                         |
                                    | h |                  Back substitution
                                    | e |                         V
 +-----------+                      | r |                 +-----------------+  回代计算S矩阵
 | Query Key | ---StandardHasher--->|   | >+++++++++++++< | SolutionStorage | (InMemSimpleSolution)
 +-----------+                      +---+        |        +-----------------+ (SerializableInterleavedSolution)
                                                 V
                                            Query result
```

很容易得到概念模型与实际代码实现的对应关系

```
概念模型                                             代码实现

BandingHasher                ----------->      StandardHasher
PhsfQueryHasher              ----------->      StandardHasher
FilterQueryHasher            ----------->      StandardHasher
BandingStorage               ----------->      StandardBanding
SimpleSolutionStorage        ----------->      InMemSimpleSolution
InterleavedSolutionStorage   ----------->      SerializableInterleavedSolution

StandardHasher存在变体实现StandardRehasherAdapter/StandardRehasher 暂不讨论
```



#### 数学函数

FloorLog2（x）：floor代表向下取整， log2代表以2为底x的对数

exp（x）：以e为底x的对数





### 性能对比UT

大致把rocksdb的代码看懂之后，我决定对比一下ribbon和bloom的性能差异，具体为在rocksdb的UT中实现HBase中的同款Bloom。然后调用rocksdb的api对比两者性能。

对于HBase中的Bloom如何实现，请见 [HBase章节](/大数据/2023/10/28/HBase.html)

代码已上传[github](https://github.com/reflectt6/rocksdb)

待解决问题：

1、大量报错、query瘫痪

在下面的配置下：

```c++
struct Settings_Coeff128_Homog : public DefaultTypesAndSettings {
  // TODO 目前有两个问题需要解决
  //  1、在这个参数下运行cell测试，求解器会崩溃，每次都返回true，待定位
  //  2、cell运行贼慢，不知道为啥，不应该的
  static constexpr bool kHomogeneous = true;
  static constexpr bool kUseSmash = false;
  using Key = Cell;
  using KeyGen = HBaseKeyGen;
  static Hash HashFn(const HBASE_BLOOM_NAMESPACE::Cell& key, uint64_t raw_seed) {
    // This version 0.7.2 preview of XXH3 (a.k.a. XXPH3) function does
    // not pass SmallKeyGen tests below without some seed premixing from
    // StandardHasher. See https://github.com/Cyan4973/xxHash/issues/469
    return ROCKSDB_NAMESPACE::Hash64(
        reinterpret_cast<const char*>(key.cellArray), key.GetRowLength(), raw_seed);
  }
  static const std::vector<ConstructionFailureChance>& FailureChanceToTest() {
    return kFailureOnlyRare;
  }
};
```

运行自定义Key为Cell的测试用例RepeatCompactnessAndBacktrackAndFpRate中，迭代次数大于0时，会大量报错

错误包含：

- query瘫痪，查询任意值都返回true

原因是由于在测试代码中引入了不通的配置类，是得测试过程中测试类中的值不正确，也就是这里

```c++
if (DefaultTypesAndSettings::kHomogeneous || overhead_ratio < 1.01 ||
            batch_size == 0) {
.....
```

由于在前面已经对类型做过重命名，这里也应该使用统一命名的配置类TypeParam，而不是DefaultTypesAndSettings

```c++
TEST(CompareTest, RepeatCompactnessAndBacktrackAndFpRate) {
  using TypeParam = Settings_Coeff128_Homog;
 .....
```

修改这点之后，UT没有再报错！

2、运行时间过长（可以规避）

- 原因在于每个Cell都要生成一个随机的col值，比较费时间。解决方式暂定为：
  - 将key改为uint32，和bloom实现保持一致。
  - 修改bloom对应的生成逻辑，也就是使用Hash32KeyGenWrapper<StandardKeyGen>生成bloom的key，然后再简单计算一下bloom的fp

考虑新的测试方案：

最好保持ribbon原生代码不变，引入hbase cell进行测试，首先分析一下ribbon原生测试逻辑

以默认配置（DefaultTypesAndSettings）下的测试Fp的UT为例（其实很多是通用的）：

```
1、使用了标准的StandardKeyGen，他会生成一个[64+prefix位数]位的string，在传递给HashFn时做隐式类型转化，变成Slice类型，最终的Hash值就是通过这个[64+prefix位数]位的Slice计算而来。（为了对照，我们在设计HBase测试用例时，也要将待Hash的部分设计为[64+prefix位数]位。具体一点，如果row为filter，则row的长度为[64+prefix位数]位，如果row/col为filter，则row+col为[64+prefix位数]位）。
```



临时测试结果：

1、ribbon homog smash（时间是两种求解器的总时间，单个时间会更少）

```
第3次迭代：
计算num时间：0ms， 其中 num_to_add = 146706, num_slots = 155136
生成HBaseKey 定义soln时间：0ms， 其中 overhead_ratio = 1.05746
banding的时间：90ms， 此时添加了num_to_add个key：146706banding占据数量146706
测试backtracking的时间：0ms，是否被跳过：0
测试添加冗余key的时间：6ms
soln求解的时间：94ms，是否跳过isoln：0
测试通过小幅度增加空间，是否可以增加banding的成功率的时间（expand）：0ms，是否被跳过：1, seed = 0
查询已添加的key时间：333ms，是否跳过isoln：0
查询soln 未添加的key，并计算fp 时间：12ms
查询isoln 未添加的key，并计算fp 时间：4ms， 是否跳过0
对比bloom的时间：1ms， 此时第3次迭代结束
```

2、bloom  one chunk， expected fp rate = 0.01

```
utilizationRate = 0.0518068
bloom chunk size = 131kb
save keys = 109306
expected fp rate = 0.01
construction time = 215ms
overhead rate = 1.19913
fp rate = 0.0084
cnt = 10000
fp_count = 84
查询已插入的key，返回true的数量 = 0
查询10000次 = 19ms
查询已插入的key的时间 = 219ms
```



### XXPH是什么？

rocksdb中存在XXPH3.h头文件，ribbon filter的实现中也存在XXPH的字样，这是啥呢？

根据头文件中的注释，XXPH就是XX Preview Hash的缩写。XX Hash是一种快速hash算法，在[github上开源](https://github.com/Cyan4973/xxHash)。而XX Preview Hash就是XX Hash的前瞻版。
