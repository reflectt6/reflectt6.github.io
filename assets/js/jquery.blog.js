/*
 * Copyright (c) 2023 reflectt6
 */

// 在此处执行希望在页面加载完成后执行的操作
$(document).ready(function () {
    var $ul = $("#catalogue-ul");
    if ($ul.length === 0) {
        return
    }
    var $li = $ul.children("li");
    var mainTagList = [];

    // 将所有blog按二级索引分类，存入mainTagList中
    $li.each(function (index, element) {
        var p = $(element).children("p");
        var url = p[0].innerHTML
        var title = p[1].innerHTML
        var mainTag = p[2].innerHTML
        var secondaryTag = p[3].innerHTML
        var matchedMainTags = $.grep(mainTagList, function (mt) {
            return mt.mTag === mainTag
        })
        var isSecondEmpty = secondaryTag === ""
        if (isSecondEmpty) {
            secondaryTag = "default"
        }
        if (matchedMainTags.length === 0) {
            // 还未添加过这个mainTag，则创建相关对象
            var newMT = new MainTag(mainTag)
            var newST = new SecondaryTag(secondaryTag)
            newST.blogs.push(new Blogs(url, title, mainTag, secondaryTag))
            newMT.secondaryTags.push(newST);
            mainTagList.push(newMT)
        } else if (matchedMainTags.length === 1) {
            // 已添加过此mainTag，下一步判断secondaryTag
            var matchedSecondaryTags = $.grep(matchedMainTags[0].secondaryTags, function (st) {
                return st.sTag === secondaryTag
            })
            if (matchedSecondaryTags.length === 0) {
                var newST2 = new SecondaryTag(secondaryTag)
                newST2.blogs.push(new Blogs(url, title, mainTag, secondaryTag))
                if (isSecondEmpty) {
                    matchedMainTags[0].secondaryTags.unshift(newST2);
                } else {
                    matchedMainTags[0].secondaryTags.push(newST2);
                }
            } else if (matchedSecondaryTags.length === 1) {
                matchedSecondaryTags[0].blogs.push(new Blogs(url, title, mainTag, secondaryTag))
                // matchedSecondaryTags[0].blogs.unshift(new Blogs(url, title, mainTag, secondaryTag))
            } else {
                alert("error")
            }
        } else {
            // mainTagList中不应该有两个一样mainTag的对象，报错
            alert("error")
        }
    })
    // 清除jekyll生成页面
    $ul.empty()
    // 导入我们自己生成的页面
    $(mainTagList).each(function (index, mt) {
        $ul.append($("<h2 class='blog1'>" + mt.mTag + "</h2>"))
        var $li2 = $("<div class='blog-div1'>")
        $(mt.secondaryTags).each(function (index, st) {
            $li2.append($("<h3 class='blog2'>" + st.sTag + "</h3>"))
            var $li3 = $("<div class='blog-div2'>")
            $(st.blogs).each(function (index, blog) {
                var b = $("<h4><a class='blog3' href='" + blog.url + "'>" + blog.title + "</a></h4>")
                $li3.append(b)
            })
            $li2.append($li3)
        })
        $ul.append($li2)
        $ul.append($("<br>"))
        $ul.append($("<br>"))
        $ul.append($("<br>"))
        $ul.append($("<br>"))
    })
});

function MainTag(mTag) {
    this.mTag = mTag;
    this.secondaryTags = [];
}

function SecondaryTag(sTag) {
    this.sTag = sTag;
    this.blogs = [];
}

function Blogs(url, title, mTag, sTag) {
    this.url = url;
    this.title = title;
    this.mTag = mTag;
    this.sTag = sTag;
}