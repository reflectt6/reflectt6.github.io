---
layout: page-with-sidebar
title:  "Cloudflare"
date:   2024-03-14 11:11:03 +0800
author: reflectt6
categories: "通信"
#permalink: 
mainTag: "通信"
secondaryTag: "网络"
hideTag: false
---

## [什么是Cloudflare？](https://developers.cloudflare.com/learning-paths/get-started/concepts/what-is-cloudflare/)

之前搭建vpn的时候用过，但是对其理解不够深刻，只知道是一个域名代理网站，可以加速。甚至对刚才这一句话也不甚理解。

但是经常看到大佬们借用它完成自己的各种服务搭建，使用反代造福群众，虽然不明白，但也能看出来这东西非常有用。

cloudflare并不是指向某个特定的功能，而是作为中间人，承接client和server之间的请求，这中间能做的事情太多了，下面先看看cloudflare有哪些产品（能力）

## 有哪些产品？

下面的链接直通官网，官网对于每一个产品都给出了tutorials，教你这个产品可以怎么样使用。例如Worker AI的教程就教你如何创建一个RAG的知识库（最近刚接触到，非常有用）

下面只列了一些，还有很多，基本上涵盖所有你能想到的应用

[所有products](https://developers.cloudflare.com/products/?product-group=Developer+platform)

可以通过FIlter选择对应的产品

![image-20240314115109530](/assets/images/2024-03-14-Cloudflare//image-20240314115109530.png)

### [Vectorize 矢量化](https://developers.cloudflare.com/vectorize/)

Build full-stack AI applications with Vectorize, Cloudflare’s vector database. Adding Vectorize enables you to perform tasks such as semantic search, recommendations, anomaly detection or can be used to provide context and memory to an LLM.
使用 Cloudflare 的矢量数据库 Vectorize 构建全栈 AI 应用程序。添加 Vectorize 使您能够执行语义搜索、推荐、异常检测等任务，或者可用于为 LLM 提供上下文和内存。

### [Workers](https://developers.cloudflare.com/workers/)

Build serverless applications and deploy instantly across the globe for exceptional performance, reliability, and scale.
构建无服务器应用程序并在全球范围内立即部署，以获得卓越的性能、可靠性和规模。

### [Pages](https://developers.cloudflare.com/pages/)

Create full-stack applications that are instantly deployed to the Cloudflare global network.
创建可立即部署到 Cloudflare 全球网络的全栈应用程序。

### [R2](https://developers.cloudflare.com/r2/)

Store large amounts of unstructured data without the costly egress bandwidth fees associated with typical cloud storage services.
存储大量非结构化数据，无需支付与典型云存储服务相关的昂贵出口带宽费用。

### [D1](https://developers.cloudflare.com/d1/)

Create new serverless SQL databases to query from your Workers and Pages projects.
创建新的无服务器 SQL 数据库以从 Workers 和 Pages 项目中进行查询。

### [Durable Objects 耐用的物体](https://developers.cloudflare.com/durable-objects/)

A globally distributed coordination API with strongly consistent storage.
具有强一致性存储的全球分布式协调 API。

### [KV](https://developers.cloudflare.com/kv/)

Create a global, low-latency, key-value data storage.
创建全局、低延迟、键值数据存储。

### [Workers AI](https://developers.cloudflare.com/workers-ai/)

Run machine learning models, powered by serverless GPUs, on Cloudflare’s global network.
在 Cloudflare 的全球网络上运行由无服务器 GPU 提供支持的机器学习模型。



## 这些产品对我们有什么好处？

### 1、高性能（CDN）

内容交付网络 (CDN) 是一组分布在不同地理位置的服务器，它将 Web 内容存放在更靠近用户的位置，从而加速 Web 内容的交付。

CDN 依赖于称为“缓存”的过程，将文件副本临时存储在全球的多个数据中心内，让您能够从就近的服务器访问互联网内容。从离您最近的服务器交付内容可以缩短页面加载时间，实现更快的高性能 Web 体验。通过在靠近您实际位置的服务器中缓存网页、图片和视频等内容，CDN 让您可以顺畅地进行观看电影、下载软件、查看银行账户余额、在社交媒体上发帖或购物等活动，而不必等待内容加载完成。

不妨把 CDN 想成是一部 ATM 机。如果您只能镇上的一家银行取钱，那么每次想取钱时，您都不得不在前往银行的路上和排长队上花费很多时间。但是，如果几乎每个街角都有一台取款机，您就可以根据需要随时随地、方便快捷地取钱。

随着内容提供商开始通过互联网交付图片和视频等更丰富的 Web 内容，CDN 服务便应运而生，用于解决类似于交通拥堵的网络拥塞问题。毕竟，将内容从中央服务器发送给各个用户用时太长。时至今日，CDN 已经取得了长足发展，涵盖了文字、图形、脚本、媒体文件到软件下载、文件、门户网站、电子商务、流媒体直播、点播式 [视频流媒体](https://www.akamai.com/zh/solutions/content-delivery-network/media-delivery)和社交媒体网站等各种各样的内容。

在 20 多年的时间里，CDN 已成为互联网隐形的中坚力量，可以提升网站性能并大规模快速地为众多公司交付在线内容。如今，在浩若烟海的互联网上，很大一部分内容都是通过 CDN 交付的。

### 2、安全性

防护网络攻击

当使用cloudflare作为我们的服务代理时，我们域名被解析称cloudflare的ip地址，而非我们自己服务器的ip地址，因此在受到DDos攻击时，实际上这个攻击会被转移到cloudflare网络，因为cloudflare是一个很大的网络集群，可以分担不少攻击压力，我们自己真实的服务器并不会暴露在攻击者面前。

![image-20240314150622699](/assets/images/2024-03-14-Cloudflare//image-20240314150622699.png)

![image-20240314150539843](/assets/images/2024-03-14-Cloudflare//image-20240314150539843.png)

### 3、可靠性

使用[Anycast网络](https://www.cloudflare.com/zh-cn/learning/cdn/glossary/anycast-network/)实现负载均衡，Anycast 是一种网络寻址和路由方法。

## [反向代理](https://www.cloudflare.com/zh-cn/learning/cdn/glossary/reverse-proxy/)

### 1、什么是代理？

![image-20240314153713207](/assets/images/2024-03-14-Cloudflare//image-20240314153713207.png)

在标准的互联网通信中，计算机 A 将直接与计算机 C 保持联系，客户端将请求发送到[源服务器](https://www.cloudflare.com/learning/cdn/glossary/origin-server/)，并且源服务器将响应客户端。当存在转发代理时，A 将请求发送到 B，B 随后将请求转发给 C。C 将向 B 发送响应，而 B 则将响应转发给 A。

为什么要将这个多余的中间设备添加到 Internet 活动中？使用转发代理可能有几个原因：

- **为避免州或机构的浏览限制**——一些政府、学校和其他组织使用防火墙来使用户访问受限版本的互联网。转发代理可用于绕过这些限制，因为它们使用户可以连接到代理，而不是直接连接到他们正在访问的站点。
- **阻止访问某些内容**——相对的，也可以设置代理以阻止特定用户群访问某些站点。例如，学校网络可能配置为通过启用内容筛选规则的代理连接到 Web，以拒绝转发来自 Facebook 和其他社交媒体网站的响应。
- **保护自己的在线身份**——在某些情况下，常规互联网用户希望增加在线匿名性，但在其他情况下，互联网用户居住在政府可能对政治异议者施加严重后果的地方。在网络论坛或社交媒体上批评政府可能会导致这些用户受到罚款或监禁。如果持不同政见者使用转发代理连接到他们发布政治敏感评论的网站，则用于发表评论的 [IP 地址](https://www.cloudflare.com/learning/dns/glossary/what-is-my-ip-address/)将更难追溯到持不同政见者。仅代理服务器的 IP 地址将对他人可见。

### 2、[什么是反向代理？](https://www.cloudflare.com/zh-cn/learning/cdn/glossary/reverse-proxy/)

反向代理是位于一个或多个 Web 服务器前面的服务器，拦截来自客户端的请求。这与转发代理不同 - 在转发代理中，代理位于客户端的前面。使用反向代理，当客户端将请求发送到网站的源服务器时，反向代理服务器会在[网络边缘](https://www.cloudflare.com/learning/serverless/glossary/what-is-edge-computing/)拦截这些请求。然后，反向代理服务器将向源服务器发送请求并从源服务器接收响应。

转发代理和反向代理之间的区别非常细微，但非常重要。简单概括而言，转发代理位于客户端的前面，确保没有源站直接与该特定客户端通信；而反向代理服务器位于源站前面，确保没有客户端直接与该源站通信。

![image-20240314153752596](/assets/images/2024-03-14-Cloudflare//image-20240314153752596.png)

通常，来自 D 的所有请求都将直接发送到 F，而 F 会直接将响应发送到 D。使用反向代理，来自 D 的所有请求都将直接发送给 E，而 E 会将其请求发送到 F 并从 F 接收响应，然后将适当响应传递给 D。

下面是反向代理的一些好处：

- **[负载均衡](https://www.cloudflare.com/learning/cdn/cdn-load-balance-reliability/)** - 一个每天吸引数百万用户的热门网站可能无法使用单个源服务器处理所有传入站点流量。但该站点可以分布在不同服务器的池中，让所有服务器都处理同一站点的请求。在这种情况下，反向代理可以提供一种负载均衡解决方案，在不同服务器之间平均分配传入流量，以防止单个服务器过载。如果某台服务器完全无法运转，则其他服务器可以代为处理流量。
- **防范攻击** - 配备反向代理后，网站或服务无需透露其源服务器的 IP 地址。这使得攻击者更难利用针对性攻击，例如 [DDoS 攻击](https://www.cloudflare.com/learning/ddos/what-is-a-ddos-attack/)。这时候，攻击者只能针对反向代理，例如 Cloudflare 的 [CDN](https://www.cloudflare.com/learning/cdn/what-is-a-cdn/)，而后者拥有具有更严格的安全性，拥有更多资源来抵御网络攻击。
- **[全局服务器负载平衡](https://www.cloudflare.com/learning/cdn/glossary/global-server-load-balancing-gslb/) (GSLB)** - 在这种负载均衡形式中，一个网站可以分布在全球各地的多个服务器上，反向代理会将客户端发送到地理位置上最接近它们的服务器。这样可以减少请求和响应传播的距离，从而最大程度地减少加载时间。
- **缓存** - 反向代理还可以[缓存](https://www.cloudflare.com/learning/cdn/what-is-caching/)内容，从而提高速度。例如，如果巴黎的用户访问使用反向代理而 Web 服务器位于洛杉矶的网站，则该用户实际上可能连接到巴黎本地的反向代理服务器，然后该本地反向代理服务器必须与洛杉矶的源服务器进行通信。之后，代理服务器可以缓存（或临时保存）响应数据。随后浏览该站点的巴黎用户将从巴黎反向代理服务器处获取本地缓存的响应，从而享受到更快的性能。
- **SSL 加密** - [加密](https://www.cloudflare.com/learning/ssl/what-is-encryption/)和解密每个客户端的 [SSL](https://www.cloudflare.com/learning/security/glossary/what-is-ssl/)（或 [TLS](https://www.cloudflare.com/learning/security/glossary/transport-layer-security-tls/)）通信对于源服务器可能需要耗费大量计算资源。可以配置由反向代理解密所有传入请求并加密所有传出响应，腾出源服务器上的宝贵资源。

### 怎么用？

说白了，反向代理就是服务器给自己搞得代理；正向代理是我们用户给自己搞得代理。

服务器使用代理，可以实现**[全局服务器负载平衡](https://www.cloudflare.com/learning/cdn/glossary/global-server-load-balancing-gslb/) (GSLB)** 。这也是很多大佬使用cloudflare反代加速的原理。

[参考这个加速github的例子](https://sobaigu.com/proxy-site-with-cloudflare.html)：你只需要自己申请一个域名，使用cloudflare的worker代理github。

1、首先将你的域名绑定在cloudflare，这样就完了cloudflare代理你自己的域名的操作。

2、在worker代码中请求github，相当于把你的域名给关联到github网站上了。

3、你请求你的域名的时候，首先cloudflare作为反代，就近挑选服务器接收你的请求，接着转发到github上，取得github响应，再将结果返回给你，享受GSLB、缓存、负载均衡带来的响应速度提升。



## 实践

[github开源反代youtobe等](https://github.com/netptop/siteproxy?tab=readme-ov-file#%E9%83%A8%E7%BD%B2%E5%88%B0cloudflare_worker)，看了一下实现很简单，待尝试。。

待尝试。。



## 资料

[官方学习路径](https://developers.cloudflare.com/learning-paths/get-started/#live_website)

[Linux.do教程](https://linux.do/t/topic/24849)
