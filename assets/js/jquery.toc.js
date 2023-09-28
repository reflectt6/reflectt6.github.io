/*
 * jQuery Table of Content Generator for Markdown v1.0
 *
 * https://github.com/dafi/tocmd-generator
 * Examples and documentation at: https://github.com/dafi/tocmd-generator
 *
 * Requires: jQuery v1.7+
 *
 * Copyright (c) 2013 Davide Ficano
 *
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 */
(function($) {
    var toggleHTML = '<div id="toctitle"><h2>%1</h2> <span class="toctoggle">[<a id="toctogglelink" class="internal" href="#">%2</a>]</span></div>';
    var tocContainerHTML = '<div id="toc-container"><table class="toc" id="toc"><tbody><tr><td>%1<ul>%2</ul></td></tr></tbody></table></div>';

    function createLevelHTML(anchorId, tocLevel, tocSection, tocNumber, tocText, tocInner) {
        var link = '<a href="#%1"><span class="tocnumber">%2</span> <span class="toctext">%3</span></a>%4'
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

            level1.nextUntil(firstHead).filter(secondHead).each(function() {
                var thirdLevelHTML = '';
                var thirdSection = 0;
                var level2 = $(this);
                ++secondSection; // 二级索引数 + 1
                ++totalSection; // 总索引数 + 1

                level2.nextUntil(secondHead).filter(thirdHead).each(function () {
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

function sidebar_toggle() {
    var $st = $(".sidebar-toggle")
    if ($st.css("z-index") === "999") {
        $("aside").css("transform","translateX(0)")
        var lsc = $("#left-side-content")
        lsc.css("left", "0%")
        $st.css("z-index", "998")
    } else {
        $("aside").css("transform","translateX(100%)")
        var lsc = $("#left-side-content")
        lsc.css("left", "19%")
        $st.css("z-index", "999")
    }
}
