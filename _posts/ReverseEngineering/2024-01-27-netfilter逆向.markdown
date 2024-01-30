---
layout: page-without-sidebar
title:  "netfilter逆向"
date:   2024-01-27 12:08:03 +0800
author: reflectt6
categories: "逆向即自由"
mainTag: "逆向即自由"
secondaryTag: "Java逆向"
---
## 序

今天抽出时间来对netfilter做个逆向，至于netfilter是用来干啥的，我不好说。。

我只能说netfilter的作者放到古代，少说也是个劫富济贫的大侠。不晓得有多少二手贩子，已经靠着大哥的成果发家致富了。

本文只研究技术，不关注应用场景。



## 前置技术

### Java代理

`-javaagent` 是在启动 Java 应用程序时使用的一个命令行选项，用于指定 Java 代理（Java Agent）。Java 代理是一个与主应用程序一起执行的 Java 程序，它可以对 Java 虚拟机（JVM）加载的类的字节码进行操作。

以下是它的简要概述：

1. **代理 JAR 文件**：`-javaagent` 选项接受一个 JAR（Java 存档）文件的路径作为参数。该 JAR 文件包含 Java 代理代码。

   示例：

   ```bash
   java -javaagent:/path/to/agent.jar -jar YourApplication.jar
   ```
   
2. **代理 Premain 方法**：Java 代理 JAR 文件必须包含一个带有 `public static void premain(String agentArgs, Instrumentation inst)` 方法的类。此方法在加载代理之前，即应用程序的 `main` 方法之前调用。

   ```java
   public class YourAgent {
       public static void premain(String agentArgs, Instrumentation inst) {
           // 放置您的插装代码
       }
   }
   ```
   
3. **插装**：`Instrumentation` 接口提供了代理在 JVM 中加载的类的字节码上进行插装的方法。这使代理能够动态修改类的行为。

   ```java
   public static void premain(String agentArgs, Instrumentation inst) {
       inst.addTransformer(new YourClassTransformer());
   }
   ```
   
   `YourClassTransformer` 类应实现 `ClassFileTransformer` 接口并定义转换逻辑。
   
4. **代理参数**：`premain` 方法中的 `agentArgs` 参数允许您向 Java 代理传递参数，以定制代理的行为。

   示例：

   ```bash
   java -javaagent:/path/to/agent.jar=arg1,arg2 -jar YourApplication.jar
   ```

总的来说，`-javaagent` 选项是一种在启动时将 Java 代理附加到 Java 应用程序的方法，使代理能够对 JVM 加载的类的字节码进行插装和修改。这种机制通常用于各种目的，包括性能分析、监控和代码操纵。



### ClassFileTransformer

`ClassFileTransformer` 是 Java Instrumentation API 中的一个接口，用于在类加载时对类文件的字节码进行转换。它允许开发者在类加载过程中动态修改类的字节码，从而实现对类的增强、监控或其他定制操作。

接口定义如下：

```java
public interface ClassFileTransformer {
    byte[] transform(ClassLoader loader, String className, Class<?> classBeingRedefined,
                     ProtectionDomain protectionDomain, byte[] classfileBuffer)
            throws IllegalClassFormatException;
}
```

接口的主要方法是 `transform` 方法，该方法接受以下参数：

- `loader`: 定义被转换类的类加载器，可能为 `null`。
- `className`: 被转换类的二进制名称（包括包路径）。
- `classBeingRedefined`: 如果是被重定义的类，则为重定义前的类；否则为 `null`。
- `protectionDomain`: 被转换类的保护域。
- `classfileBuffer`: 类文件的字节数组。

方法返回一个新的字节数组，代表转换后的字节码。如果不进行转换，可以返回原始的 `classfileBuffer`。

使用 `ClassFileTransformer` 通常需要结合 Java Instrumentation API 和 Java Agent 来实现。一个简单的例子如下：

```java
import java.lang.instrument.ClassFileTransformer;
import java.lang.instrument.IllegalClassFormatException;
import java.security.ProtectionDomain;

public class MyTransformer implements ClassFileTransformer {

    @Override
    public byte[] transform(ClassLoader loader, String className, Class<?> classBeingRedefined,
                            ProtectionDomain protectionDomain, byte[] classfileBuffer)
            throws IllegalClassFormatException {

        // 在这里实现对类字节码的转换逻辑

        // 返回转换后的字节码
        return transformedClassfileBuffer;
    }
}
```

然后，你需要在 Java Agent 中注册这个 `ClassFileTransformer`，并将其与目标 JVM 进程关联起来。这通常在 `premain` 或 `agentmain` 方法中完成。
