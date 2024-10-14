---
layout: page-with-sidebar
title:  "ClassLoader"
date:   2024-10-14 9:47:03 +0800
author: reflectt6
categories: "Java"
mainTag: "编程基础"
secondaryTag: "Java"
hideTag: false
---

## ClassLoader基础

- from gpt

  `ClassLoader` 是 Java 中负责加载类的机制。它动态地将类的字节码加载到 JVM 中，使得 Java 支持动态加载类。这是 Java 反射、插件系统、JSP 等技术的核心。

  ### `ClassLoader` 的工作原理

  `ClassLoader` 通过将 `.class` 文件读取到内存中，将类的字节码转换为 `Class` 对象，并且管理类的加载。Java 的类加载机制采用 **双亲委派模型** 来保证类加载的安全性和稳定性。

  ### 双亲委派模型

  在 Java 中，类加载是由一系列的 `ClassLoader` 以层次化的方式进行的，即每个类加载器都有一个父加载器。当一个 `ClassLoader` 尝试加载类时，它会首先请求其父加载器加载该类，如果父加载器不能加载，才会由子加载器尝试加载。

  双亲委派机制的步骤如下：

  1. 类加载器先将类加载请求委派给父类加载器。
  2. 如果父加载器能够成功加载类，则直接返回。
  3. 如果父加载器无法加载类，则子加载器自行加载该类。

  这种机制的目的是确保 Java 核心类库（如 `java.lang.Object`）只会被引导类加载器加载，防止重复加载，确保安全性。

  ### 类加载器的层次结构

  1. **引导类加载器（Bootstrap ClassLoader）**：
     - 负责加载 Java 核心类库（`rt.jar`），如 `java.lang.*`、`java.util.*` 等。
     - 它是最顶层的类加载器，使用 C++ 实现，无法直接访问和控制。

  2. **扩展类加载器（Extension ClassLoader）**：
     - 负责加载扩展库中的类，通常是 `JAVA_HOME/lib/ext` 目录下的类。

  3. **应用类加载器（Application ClassLoader）**：
     - 也称为系统类加载器，负责加载应用程序的类路径中的类，即 `CLASSPATH` 中的类。
     - 这是大多数开发者接触最多的类加载器。

  4. **自定义类加载器**：
     - 开发者可以通过继承 `ClassLoader` 类创建自己的类加载器，用于特殊需求（如加载远程类或加密类）。

  ### `ClassLoader` 类的常用方法

  1. **`loadClass(String name)`**：

     - 加载指定类。默认会调用双亲委派模型来加载类。

     ```java
     Class<?> clazz = ClassLoader.getSystemClassLoader().loadClass("java.util.ArrayList");
     ```

  2. **`findClass(String name)`**：

     - 通过名称查找类。子类可以重写这个方法自定义类的加载逻辑，但一般直接调用 `loadClass`。

  3. **`getResource(String name)` 和 `getResourceAsStream(String name)`**：

     - 用于查找类路径中的资源文件。

     ```java
     InputStream input = ClassLoader.getSystemResourceAsStream("config.properties");
     ```

  4. **`getParent()`**：

     - 返回当前类加载器的父加载器。

  5. **`defineClass(String name, byte[] b, int off, int len)`**：

     - 将字节数组中的类数据转换为 `Class` 对象。这个方法常用于自定义类加载器。

  ### 自定义类加载器

  自定义类加载器通常用于加载动态生成的类或远程类。以下是一个简单的自定义类加载器示例，它从指定路径加载 `.class` 文件。

  ```java
  import java.io.File;
  import java.io.FileInputStream;
  import java.io.IOException;
  
  public class MyClassLoader extends ClassLoader {
  
      private String classPath;
  
      public MyClassLoader(String classPath) {
          this.classPath = classPath;
      }
  
      @Override
      protected Class<?> findClass(String name) throws ClassNotFoundException {
          byte[] classBytes = loadClassData(name);
          if (classBytes == null) {
              throw new ClassNotFoundException();
          }
          return defineClass(name, classBytes, 0, classBytes.length);
      }
  
      private byte[] loadClassData(String className) throws ClassNotFoundException {
          String filePath = classPath + "/" + className.replace('.', '/') + ".class";
          try (FileInputStream fis = new FileInputStream(new File(filePath))) {
              byte[] buffer = new byte[fis.available()];
              fis.read(buffer);
              return buffer;
          } catch (IOException e) {
              e.printStackTrace();
              return null;
          }
      }
  
      public static void main(String[] args) throws Exception {
          // 实例化自定义类加载器，加载指定目录下的类
          MyClassLoader myClassLoader = new MyClassLoader("/path/to/classes");
          Class<?> clazz = myClassLoader.loadClass("com.example.MyClass");
  
          // 输出加载的类名
          System.out.println("Loaded class: " + clazz.getName());
      }
  }
  ```

  ### 代码说明：

  1. **findClass()**：重写 `findClass` 方法来定义如何加载类。在这里，我们从文件系统中加载类的字节码并通过 `defineClass` 将其转为 `Class` 对象。
  2. **loadClassData()**：从指定的路径读取 `.class` 文件的字节数据。

  ### 结论

  `ClassLoader` 是 Java 中的一个强大工具，负责动态加载类文件。它使用双亲委派模型来保证类加载的安全和一致性。通过自定义类加载器，开发者可以实现灵活的类加载机制，满足特殊的需求。



## 获取ClassLoader

- from gpt

  在 Java 中，你可以通过以下几种方式获取当前的 `ClassLoader`，以便在运行时动态加载类或资源。

  ### 1. 获取当前类的 `ClassLoader`
  每个类在 JVM 中都有一个与之关联的 `ClassLoader`，你可以通过调用 `getClass().getClassLoader()` 方法来获取当前类的 `ClassLoader`。

  ```java
  public class Example {
      public static void main(String[] args) {
          // 获取当前类的 ClassLoader
          ClassLoader classLoader = Example.class.getClassLoader();
          System.out.println(classLoader);
      }
  }
  ```

  ### 2. 获取线程上下文 `ClassLoader`
  Java 线程可以有自己的 `ClassLoader`，可以通过 `Thread.currentThread().getContextClassLoader()` 获取当前线程的 `ClassLoader`。

  ```java
  public class Example {
      public static void main(String[] args) {
          // 获取当前线程的 ClassLoader
          ClassLoader contextClassLoader = Thread.currentThread().getContextClassLoader();
          System.out.println(contextClassLoader);
      }
  }
  ```

  ### 3. 获取系统类加载器（应用类加载器）
  系统类加载器负责加载 `CLASSPATH` 中的类和资源。你可以通过 `ClassLoader.getSystemClassLoader()` 获取它。

  ```java
  public class Example {
      public static void main(String[] args) {
          // 获取系统类加载器
          ClassLoader systemClassLoader = ClassLoader.getSystemClassLoader();
          System.out.println(systemClassLoader);
      }
  }
  ```

  ### 4. 获取类加载器的父加载器
  可以通过调用 `getParent()` 方法获取当前 `ClassLoader` 的父类加载器。例如，可以获取扩展类加载器或引导类加载器。

  ```java
  public class Example {
      public static void main(String[] args) {
          // 获取当前类的 ClassLoader
          ClassLoader classLoader = Example.class.getClassLoader();
          
          // 获取父加载器
          ClassLoader parentClassLoader = classLoader.getParent();
          System.out.println("当前类的 ClassLoader: " + classLoader);
          System.out.println("父 ClassLoader: " + parentClassLoader);
      }
  }
  ```

  ### 总结：
  1. **当前类的 `ClassLoader`**：`Example.class.getClassLoader()`
  2. **线程上下文 `ClassLoader`**：`Thread.currentThread().getContextClassLoader()`
  3. **系统类加载器**：`ClassLoader.getSystemClassLoader()`
  4. **父类加载器**：通过 `getParent()` 获取。

  这些方法可以帮助你在运行时动态加载类或资源，并且可以了解当前类加载器的层次结构。
