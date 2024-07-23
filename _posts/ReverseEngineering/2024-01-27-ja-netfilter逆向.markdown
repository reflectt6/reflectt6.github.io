---
layout: page-without-sidebar
title:  "ja-netfilter逆向"
date:   2024-01-27 12:08:03 +0800
author: reflectt6
categories: "Java逆向"
mainTag: "逆向即自由"
secondaryTag: "Java逆向"
hideTag: false
---
## 序

今天抽出时间来对ja-netfilter做个逆向，至于ja-netfilter是用来干啥的，相信你已经有所耳闻🐶。

[框架仓库](https://gitee.com/organizations/reflectt6-space/projects)，包含netfilter和几个插件的实现。



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



## 使用指南

ja-netfilter实际上是一个Java Instrumentation的框架项目。主要作用是简化了开发流程。用户只需要继承接口开发简单的Plugin，再配合ja-netfilter的jar包即可完成Instrumentation的开发。

根据ja-netfilter的代码可知，应该在被代理的java程序中添加如下VM参数：

```shell
## JAVA17及以上需要添加一下参数
--add-opens=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED
--add-opens=java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED

## 后面这个=[插件目录]可加可不加
## 如果加的话，框架会去ja-netfilter.jar的同级目录下找plugins-[插件目录]和config-[插件目录]两个目录，并从中找到实际的plugin的jar包和config
## 如果不加的话，框架会去ja-netfilter.jar的同级目录下找plugins和config两个目录，并从中找到实际的plugin的jar包和config

## 插件jar包如果以“.disabled.jar”结尾，则该jar包会被ja-netfilter忽略
-javaagent:[绝对路径]/ja-netfilter.jar=[插件目录]
```





## 插件开发

一个最简单的插件例子

```java
package my.sample.plugin;

import com.janetfilter.core.commons.DebugInfo;
import com.janetfilter.core.plugin.MyTransformer;

public class TestTransformer implements MyTransformer {
    @Override
    public String getHookClassName() {
        return "sun/security/x509/X509CertImpl";
    }

    @Override
    public byte[] transform(String className, byte[] classBytes, int order) throws Exception {
        DebugInfo.debug("Oh! It's you: " + className);

        return classBytes;
    }
}
```

getHookClassName方法需要你返回你想代理的类的全路径名。transform接收className类名和classBytes类字节码。这里你只需要用一些Java Instrumentation API 去修改原来的字节码，并返回修改后的字节码就可以完成对原有类的Hook。

举个例子：

我们先写一个计算器程序，然后尝试hook它，使他返回固定值15.

```java
package org.example;

import java.util.Scanner;

public class App {

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        System.out.println("Welcome to the Command Line Calculator!");
        System.out.println("Enter an expression (e.g., 2 + 2) or type 'exit' to quit:");

        while (true) {
            System.out.print("> ");
            String input = scanner.nextLine().trim();

            if (input.equalsIgnoreCase("exit")) {
                System.out.println("Goodbye!");
                break;
            }

            try {
                double result = evaluate(input);
                System.out.println("Result: " + result);
            } catch (Exception e) {
                System.out.println("Invalid expression. Please try again.");
            }
        }

        scanner.close();
    }

    public static double evaluate(String expression) throws Exception {
        String[] tokens = expression.split(" ");
        if (tokens.length != 3) {
            throw new Exception("Invalid expression format.");
        }

        double num1 = Double.parseDouble(tokens[0]);
        String operator = tokens[1];
        double num2 = Double.parseDouble(tokens[2]);

        return calculate(num1, operator, num2);
    }

    public static double calculate(double num1, String operator, double num2) throws Exception {
        switch (operator) {
            case "+":
                return num1 + num2;
            case "-":
                return num1 - num2;
            case "*":
                return num1 * num2;
            case "/":
                if (num2 == 0) {
                    throw new ArithmeticException("Division by zero is not allowed.");
                }
                return num1 / num2;
            default:
                throw new Exception("Unknown operator: " + operator);
        }
    }
}
```

实现plugin修改calculate这个方法，使他只能返回15

```java
package my.sample.plugins.demo;

import com.janetfilter.core.commons.DebugInfo;
import com.janetfilter.core.plugin.MyTransformer;
import jdk.internal.org.objectweb.asm.ClassReader;
import jdk.internal.org.objectweb.asm.ClassWriter;
import jdk.internal.org.objectweb.asm.Opcodes;
import jdk.internal.org.objectweb.asm.tree.*;

import static jdk.internal.org.objectweb.asm.Opcodes.*;

public class TestTransformer implements MyTransformer {
    @Override
    public String getHookClassName() {
        return "org/example/App";
    }

    @Override
    public byte[] transform(String className, byte[] classBytes, int order) throws Exception {
        DebugInfo.debug("Oh! It's you: " + className);
        ClassReader reader = new ClassReader(classBytes);
        ClassNode node = new ClassNode(ASM5);
        reader.accept(node, 0);

        for (MethodNode m : node.methods) {
            if ("calculate".equals(m.name)) {
                if (!"(DLjava/lang/String;D)D".equals(m.desc)) {
                    continue;
                }
                InsnList list = new InsnList();

                // 将 double 值 15.0 压入操作数栈
                list.add(new LdcInsnNode(15.0));

                // 返回 double 值
                list.add(new InsnNode(Opcodes.DRETURN));

                m.instructions.insert(list);
            }
        }

        ClassWriter writer = new ClassWriter(ClassWriter.COMPUTE_FRAMES | ClassWriter.COMPUTE_MAXS);
        node.accept(writer);

        return writer.toByteArray();
    }
}
```

分别打成jar包，添加VM参数运行

```shell
## 启用debug info
export JANF_DEBUG=1


java --add-opens=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED --add-opens=java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED -javaagent:../ja-netfilter/target/ja-netfilter-jar-with-dependencies.jar -jar calculator/target/calculator-1.0-SNAPSHOT-jar-with-dependencies.jar
```

不出意外你会看到，你的计算器已经只能输出15了，而计算器jar包本身并没有被修改。确实🐮！

![image-20240723104527430](/assets/images/2024-01-27-netfilter逆向//image-20240723104527430.png)
