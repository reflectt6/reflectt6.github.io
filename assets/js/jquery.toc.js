/*
 * Copyright (c) 2023 reflectt6
 */

function active(event) {
    var act = $("#active")
    if (act.length > 0) {
        act.attr("id", "inactive")
        act[0].innerHTML = act[0].innerHTML.substring(2)
    }
    var $li = $(event)
    $li.attr("id", "active")
    $li[0].innerHTML = "✅ " + $li[0].innerHTML
}

(function($) {
    var toggleHTML = '<div id="toctitle"><h2>%1</h2> <span class="toctoggle">[<a id="toctogglelink" class="internal" href="#">%2</a>]</span></div>';
    var tocContainerHTML = '<div id="toc-container"><table class="toc" id="toc"><tbody><tr><td>%1<ul>%2</ul></td></tr></tbody></table></div>';

    function createLevelHTML(anchorId, tocLevel, tocSection, tocNumber, tocText, tocInner) {
        // var link = '<a href="#%1"><span class="tocnumber">%2</span> <span class="toctext">%3</span></a>%4'
        var link = '<a class="toctext" href="#%1" onclick="active(this)">%2 %3</a>%4'
            .replace('%1', anchorId)
            .replace('%2', tocNumber)
            .replace('%3', tocText)
            .replace('%4', tocInner ? tocInner : '');
        return '<li class="toclevel-%1 tocsection-%2">%3</li>\n'
            .replace('%1', tocLevel)
            .replace('%2', tocSection)
            .replace('%3', link);
    }

    function checkMaxHead($root) {
        if ($root.find('h1').length > 0) {
            return ['h1', 'h2', 'h3'];
        } else {
            return ['h2', 'h3', 'h4'];
        }
    }

    $.fn.toc = function(settings) {
        var config = {
            renderIn: 'self',
            anchorPrefix: 'tocAnchor-',
            showAlways: false,
            minItemsToShowToc: 2,
            saveShowStatus: true,
            contentsText: 'Contents',
            hideText: 'hide',
            showText: 'show',
            showCollapsed: false};

        if (settings) {
            $.extend(config, settings);
        }

        var tocHTML = '';
        var tocLevel = 1; // 表示这是第几级的索引
        var totalSection = 0; // 表示从上到下 这是第几个索引（全局统计）
        var firstSection = 0; // 表示这是第几个 一级索引

        var tocContainer = $(this);

        var heads = checkMaxHead(tocContainer);
        var firstHead = heads[0];
        var secondHead = heads[1];
        var thirdHead = heads[2];

        tocContainer.find(firstHead).each(function() {
            var secondLevelHTML = '';
            var secondSection = 0; // 表示这是第几个二级索引
            var level1 = $(this);
            ++firstSection; // 一级索引数 + 1
            ++totalSection; // 总索引数 + 1

            var searchSec = level1.nextUntil(firstHead).filter(secondHead)
            if (searchSec.length === 0) {
                searchSec = level1.nextUntil(firstHead).find(secondHead)
            }
            searchSec.each(function() {
                var thirdLevelHTML = '';
                var thirdSection = 0;
                var level2 = $(this);
                ++secondSection; // 二级索引数 + 1
                ++totalSection; // 总索引数 + 1

                var thirdSec = level2.nextUntil(secondHead).filter(thirdHead)
                if (thirdSec.length === 0) {
                    thirdSec = level2.nextUntil(secondHead).find(thirdHead)
                }
                thirdSec.each(function () {
                    var level3 = $(this)
                    ++thirdSection; // 三级索引数 + 1
                    ++totalSection; // 总索引数 + 1

                    var curTocLevel = tocLevel + 2;
                    var anchorId = config.anchorPrefix
                        + firstSection + '-' + secondSection + '-' + thirdSection;
                    level3.attr('id', anchorId);
                    thirdLevelHTML += createLevelHTML(anchorId,
                        curTocLevel,
                        totalSection,
                        firstSection + '.' + secondSection + '.' + thirdSection,
                        level3.text())
                })

                if (thirdLevelHTML) {
                    thirdLevelHTML = '<ul>' + thirdLevelHTML + '</ul>\n';
                }
                var curTocLevel = tocLevel + 1;
                var anchorId = config.anchorPrefix
                    + firstSection + '-' + secondSection;
                level2.attr('id', anchorId);
                secondLevelHTML += createLevelHTML(anchorId,
                    curTocLevel,
                    totalSection,
                    firstSection + '.' + secondSection,
                    level2.text(),
                    thirdLevelHTML);
            });
            if (secondLevelHTML) {
                secondLevelHTML = '<ul>' + secondLevelHTML + '</ul>\n';
            }
            var anchorId = config.anchorPrefix + firstSection;
            level1.attr('id', anchorId);
            tocHTML += createLevelHTML(anchorId,
                tocLevel,
                totalSection,
                firstSection,
                level1.text(),
                secondLevelHTML);
        });

        // for convenience itemNumber starts from 1
        // so we decrement it to obtain the index count
        var tocIndexCount = firstSection - 1;

        var show = config.showAlways ? true : config.minItemsToShowToc <= tocIndexCount;

        // check if cookie plugin is present otherwise doesn't try to save
        if (config.saveShowStatus && typeof($.cookie) == "undefined") {
            config.saveShowStatus = false;
        }

        if (show && tocHTML) {
            var replacedToggleHTML = toggleHTML
                .replace('%1', config.contentsText)
                .replace('%2', config.hideText);
            var replacedTocContainer = tocContainerHTML
                .replace('%1', replacedToggleHTML)
                .replace('%2', tocHTML);

            // Renders in default or specificed path
            if (config.renderIn != 'self') {
              $(config.renderIn).html(replacedTocContainer);
            } else {
              tocContainer.prepend(replacedTocContainer);
            }

            $('#toctogglelink').click(function() {
                var ul = $($('#toc ul')[0]);

                if (ul.is(':visible')) {
                    ul.hide();
                    $(this).text(config.showText);
                    if (config.saveShowStatus) {
                        $.cookie('toc-hide', '1', { expires: 365, path: '/' });
                    }
                    $('#toc').addClass('tochidden');
                } else {
                    ul.show();
                    $(this).text(config.hideText);
                    if (config.saveShowStatus) {
                        $.removeCookie('toc-hide', { path: '/' });
                    }
                    $('#toc').removeClass('tochidden');
                }
                return false;
            });

            if (config.saveShowStatus && $.cookie('toc-hide')) {
                var ul = $($('#toc ul')[0]);

                ul.hide();
                $('#toctogglelink').text(config.showText);
                $('#toc').addClass('tochidden');
            }

            if (config.showCollapsed) {
                $('#toctogglelink').click();
            }
        }
        return this;
    }
})(jQuery);

function startComputeToc() {
    $('.header-container').toc({
        showAlways: true,
        renderIn: '.sidebar-nav',
        contentsText: "章节目录",
        hideText: '收起',
        showText: '展开',
        showCollapsed: false
    })
    return this;
}

function sidebar_toggle() {
    var $st = $(".sidebar-toggle")
    if ($st.length === 0) {
        return
    }
    if ($st.css("z-index") === "2") {
        $("aside").css("transform","translateX(0)")
        var lsc = $("#left-side-content")
        lsc.css("left", "0%")
        $st.css("z-index", "1")
    } else {
        $("aside").css("transform","translateX(100%)")
        var lsc = $("#left-side-content")
        // lsc.css("left", "20%")
        lsc.css("left", "300px")
        $st.css("z-index", "2")
    }
}

$(document).ready(function () {
    var $body = $("body")
    // 不知道为啥文档就绪事件会触发两次，通过data标志位，判断事件是否已经被监听，防止多次监听事件带来的方法多次执行问题
    // https://blog.51cto.com/u_16175504/7284150
    if(!$body.data("tab-shortcut")) {
        $body.on("keyup", function (e) {
            // Tab 切换侧边栏
            if (e.which === 9) {
                sidebar_toggle()
            }
        })
        // 移除浏览器默认的tab操作
        $body.on('keydown', function(e){
            var keyCode = e.keyCode || e.which;
            if (keyCode === 9) {
                e.preventDefault();
            }
        });
        $body.data("tab-shortcut", true)
    }
})

