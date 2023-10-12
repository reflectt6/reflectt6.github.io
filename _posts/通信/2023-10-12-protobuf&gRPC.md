---
layout: page-with-sidebar
title:  "protobuf&gRPC"
date:   2023-10-12 11:11:03 +0800
author: reflectt6
categories: "通信"
#permalink: 
mainTag: "通信"
secondaryTag: "序列化"
---

## 前言

protobuf、grpc被广泛应用与各个编程领域。包括但不限于大数据领域，学习protobuf是非常必要的。今天来整理一下相关知识点。

## 介绍

开始之前，先介绍一下什么是protobuf以及grpc。这里有一个现成的网站，详细讲了这一切。他就是[grpc的官网](https://grpc.io/docs/what-is-grpc/introduction/)。

知道大多数人懒得看英文，我来翻译一波。

### 什么是protobuf：

全称protocol buffers。是一种google定义的序列化结构，作用就在于序列化数据。和JSON的作用是一样的。

### 什么是gRPC：

是google自定义的一种RPC。RPC全称Remote Procedure Call，也就是远程过程调用。常用场景为：client端想执行在server端执行一个方法。那么只需要server端实现gRPC的接口，gRPC会在server端创建一个监听程序。监听程序监听到client端发出的请求，则会将入参（默认是protobuf格式）解析出来，在server端运行，并将结果发回client，由此完成一次远程调用。而创建监听程序，解析入参，返回结果给client的操作都是由gRPC框架完成的，用户对于此无感知。

并且server端和client的编程语言可以不一样，这就大大增强了代码的可扩展性。

### 关于protobuf版本

关于gRPC的版本问题，截止2023年10月。官方默认的版本是proto2，但是如果你使用了gRPC，那么推荐你使用proto3，因为proto3支持了gRPC支持的所有语言。使用proto3可以避免某些proto语言不支持，但是gRPC中却使用了造成的问题。

## 使用gRPC

### 定义protobuf数据结构

你需要在 `.proto`结尾的文件中定义类似下面的结构

```protobuf
message Person {
  string name = 1;
  int32 id = 2;
  bool has_ponycopter = 3;
}
```

接着你就可以使用protobuf编译器生成你需要语言的代码了，以C++为例，他会创建一个Person类，并且生成序列化和反序列化的方法。

每个语言可能有些特殊的option，比如：

```protobuf
option java_outer_classname = "Foo";
```

官网上有对各种语言的支持文档，例如[java文档](https://protobuf.dev/reference/java/java-generated/#invocation)

### 定义gRPC（远程方法调用）

```protobuf
// The greeter service definition.
service Greeter {
  // Sends a greeting
  rpc SayHello (HelloRequest) returns (HelloReply) {}
}

// The request message containing the user's name.
message HelloRequest {
  string name = 1;
}

// The response message containing the greetings
message HelloReply {
  string message = 1;
}
```

接着你就可以使用特定的gRPC插件，生成gRPC Server端和client端的代码，同时他也会生成入参和返回值对应的protobuf数据结构代码。

