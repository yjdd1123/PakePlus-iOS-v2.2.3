(function (storyContent) {
  let isSingleSentenceModeEnabled = false;
  let saveSlots = [];

  // 通常随机数 SEED 会被存档，即使 load & save，下一个随机数也是相同的
  // 如果想每次读档后的随机数不同，则打开它
  // 打开为 true，关闭为 false，默认关闭
  let refreshRandomSeedWhenLoad = false;

  // Create ink story from the content using inkjs
  var story = new inkjs.Story(storyContent);

  var savePoint = "";

  let savedTheme;
  let globalTagTheme;

  // Global tags - those at the top of the ink file
  // We support:
  //  # theme: dark
  //  # author: Your Name
  var globalTags = story.globalTags;
  if (globalTags) {
    for (var i = 0; i < story.globalTags.length; i++) {
      var globalTag = story.globalTags[i];
      var splitTag = splitPropertyTag(globalTag);

      // THEME: dark
      if (splitTag && splitTag.property == "theme") {
        globalTagTheme = splitTag.val;
      }

      // author: Your Name
      else if (splitTag && splitTag.property == "author") {
        var byline = document.querySelector(".byline");
        byline.innerHTML = "by " + splitTag.val;
      }
    }
  }

  var storyContainer = document.querySelector("#story");
  var outerScrollContainer = document.querySelector(".outerContainer");

  // page features setup
  setupTheme(globalTagTheme);
  var hasSave = loadSavePoint();
  setupButtons(hasSave);

  // Set initial save point
  savePoint = story.state.toJson();

  // Kick off the start of the story!
  continueStory(true);

  // Main story processing function. Each time this is called it generates
  // all the next content up as far as the next set of choices.
  async function continueStory(firstTime) {
    var paragraphIndex = 0;
    var delay = 0.0;

    // Don't over-scroll past new content
    var previousBottomEdge = firstTime ? 0 : contentBottomEdgeY();

    let nextInputBox = false;
    let nextInputVariableName = null;

    // Generate story text - loop through available content
    while (story.canContinue) {
      // Get ink to generate the next paragraph
      var paragraphText = story.Continue();
      var tags = story.currentTags;

      // Any special tags included with this line
      var customClasses = [];
      for (var i = 0; i < tags.length; i++) {
        var tag = tags[i];

        // Detect tags of the form "X: Y". Currently used for IMAGE and CLASS but could be
        // customised to be used for other things too.
        var splitTag = splitPropertyTag(tag);
        splitTag.property = splitTag.property.toUpperCase();

        // AUDIO: src
        if (splitTag && splitTag.property == "AUDIO") {
          if ("audio" in this) {
            this.audio.pause();
            this.audio.removeAttribute("src");
            this.audio.load();
          }
          this.audio = new Audio(splitTag.val);
          this.audio.play();
        }

        // AUDIOLOOP: src
        else if (splitTag && splitTag.property == "AUDIOLOOP") {
          if ("audioLoop" in this) {
            this.audioLoop.pause();
            this.audioLoop.removeAttribute("src");
            this.audioLoop.load();
          }
          this.audioLoop = new Audio(splitTag.val);
          this.audioLoop.play();
          this.audioLoop.loop = true;
        }

        // IMAGE: src
        if (splitTag && splitTag.property == "IMAGE") {
          var imageElement = document.createElement("img");
          imageElement.src = splitTag.val;
          storyContainer.appendChild(imageElement);

          imageElement.onload = () => {
            console.log(`scrollingto ${previousBottomEdge}`);
            scrollDown(previousBottomEdge);
          };

          showAfter(delay, imageElement);
          delay += 200.0;
        }

        // LINK: url
        else if (splitTag && splitTag.property == "LINK") {
          window.location.href = splitTag.val;
        }

        // LINKOPEN: url
        else if (splitTag && splitTag.property == "LINKOPEN") {
          window.open(splitTag.val);
        }

        // BACKGROUND: src
        else if (splitTag && splitTag.property == "BACKGROUND") {
          outerScrollContainer.style.backgroundImage =
            "url(" + splitTag.val + ")";
        }

        // CLASS: className
        else if (splitTag && splitTag.property == "CLASS") {
          customClasses.push(splitTag.val);
        }

        // CLEAR - removes all existing content.
        // RESTART - clears everything and restarts the story from the beginning
        else if (tag == "CLEAR" || tag == "RESTART") {
          removeAll("p");
          removeAll("img");

          // Comment out this line if you want to leave the header visible when clearing
          setVisible(".header", false);

          if (tag == "RESTART") {
            isSingleSentenceModeEnabled = false;
            restart();
            return;
          }
        }

        // 单句模式
        else if (splitTag && splitTag.property == "SINGLE_SENTENCE") {
          if (splitTag.val == "on") {
            isSingleSentenceModeEnabled = true;
          } else if (splitTag.val == "off") {
            isSingleSentenceModeEnabled = false;
          }
        }

        // 可控制宽度的图片
        else if (splitTag && splitTag.property == "SIZE_IMAGE") {
          let imageElement = document.createElement("img");

          let content = splitTag.val;
          let idx = content.indexOf("@");
          if (idx != null) {
            let size = content.substr(0, idx).trim();
            let src = content.substr(idx + 1).trim();
            imageElement.src = src;
            imageElement.style.width = size;
            storyContainer.appendChild(imageElement);

            imageElement.onload = () => {
              console.log(`scrollingto ${previousBottomEdge}`);
              scrollDown(previousBottomEdge);
            };

            showAfter(delay, imageElement);
            delay += 200.0;
          }
        }

        // 背景图片
        else if (splitTag && splitTag.property == "BG_IMAGE") {
          if (splitTag.val == "hide") {
            hideBg();
          } else {
            showBg(splitTag.val);
          }
        }

        // 背景音乐
        else if (splitTag && splitTag.property == "BGM") {
          if (splitTag.val == "stop") {
            // 停止
            stopBgm();
          } else if (splitTag.val == "pause") {
            // 暂停
            pauseBgm();
          } else if (splitTag.val == "resume") {
            // 继续
            resumeBgm();
          } else {
            // 播放
            playBgm(splitTag.val);
          }
        }

        // 音效
        else if (splitTag && splitTag.property == "SE") {
          // 播放 SE
          console.log("play se: " + splitTag.val);
          let se = new Audio(splitTag.val);
          se.play();
        } else if (splitTag && splitTag.property == "INPUT") {
          nextInputBox = true;
          nextInputVariableName = splitTag.val;
        }
      }

      // Check if paragraphText is empty
      if (paragraphText.trim().length == 0) {
        continue; // Skip empty paragraphs
      }

      // Create paragraph element (initially hidden)
      var paragraphElement = document.createElement("p");
      paragraphElement.innerHTML = paragraphText;
      storyContainer.appendChild(paragraphElement);

      // Add any custom classes derived from ink tags
      for (var i = 0; i < customClasses.length; i++)
        paragraphElement.classList.add(customClasses[i]);

      // Fade in paragraph after a short delay
      showAfter(delay, paragraphElement);
      delay += 200.0;

      if (isSingleSentenceModeEnabled && story.currentChoices.length == 0) {
        // 等待单句模式提示显示完成
        await addSingleSentenceHint(delay);
      }

      if (nextInputBox) {
        // 等待输入框的处理完成
        nextInputBox = false;
        await addInputBox(nextInputVariableName, delay);
      }
    }

    // Create HTML choices from ink choices
    story.currentChoices.forEach(function (choice) {
      // Create paragraph with anchor element
      var choiceTags = choice.tags;
      var customClasses = [];
      var isClickable = true;
      for (var i = 0; i < choiceTags.length; i++) {
        var choiceTag = choiceTags[i];
        var splitTag = splitPropertyTag(choiceTag);
        splitTag.property = splitTag.property.toUpperCase();

        if (choiceTag.toUpperCase() == "UNCLICKABLE") {
          isClickable = false;
        }

        if (splitTag && splitTag.property == "CLASS") {
          customClasses.push(splitTag.val);
        }
      }

      var choiceParagraphElement = document.createElement("p");
      choiceParagraphElement.classList.add("choice");

      for (var i = 0; i < customClasses.length; i++)
        choiceParagraphElement.classList.add(customClasses[i]);

      if (isClickable) {
        choiceParagraphElement.innerHTML = `<a href='#'>${choice.text}</a>`;
      } else {
        choiceParagraphElement.innerHTML = `<span class='unclickable'>${choice.text}</span>`;
      }
      storyContainer.appendChild(choiceParagraphElement);

      // Fade choice in after a short delay
      showAfter(delay, choiceParagraphElement);
      delay += 200.0;

      // Click on choice
      if (isClickable) {
        var choiceAnchorEl = choiceParagraphElement.querySelectorAll("a")[0];
        choiceAnchorEl.addEventListener("click", async function (event) {
          // Don't follow <a> link
          event.preventDefault();

          // Extend height to fit
          // We do this manually so that removing elements and creating new ones doesn't
          // cause the height (and therefore scroll) to jump backwards temporarily.
          storyContainer.style.height = contentBottomEdgeY() + "px";

          // Remove all existing choices
          removeAll(".choice");

          // Tell the story where to go next
          story.ChooseChoiceIndex(choice.index);

          // This is where the save button will save from
          savePoint = story.state.toJson();

          // Aaand loop
          await continueStory();

          // 防止冒泡
          if (isSingleSentenceModeEnabled) {
            event.stopPropagation();
          }
        });
      }
    });

    // Unset storyContainer's height, allowing it to resize itself
    storyContainer.style.height = "";

    if (!firstTime) scrollDown(previousBottomEdge);
  }

  async function restart() {
    story.ResetState();
    setVisible(".header", true);
    savePoint = story.state.toJson();
    await continueStory(true);
    outerScrollContainer.scrollTo(0, 0);
  }

  // -----------------------------------
  // Various Helper functions
  // -----------------------------------

  // Detects whether the user accepts animations
  function isAnimationEnabled() {
    return window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
  }

  // Fades in an element after a specified delay
  function showAfter(delay, el) {
    if (isAnimationEnabled()) {
      el.classList.add("hide");
      setTimeout(function () {
        el.classList.remove("hide");
      }, delay);
    } else {
      // If the user doesn't want animations, show immediately
      el.classList.remove("hide");
    }
  }

  // Scrolls the page down, but no further than the bottom edge of what you could
  // see previously, so it doesn't go too far.
  function scrollDown(previousBottomEdge) {
    // If the user doesn't want animations, let them scroll manually
    if (!isAnimationEnabled()) {
      return;
    }

    // Line up top of screen with the bottom of where the previous content ended
    var target = previousBottomEdge;

    // Can't go further than the very bottom of the page
    var limit =
      outerScrollContainer.scrollHeight - outerScrollContainer.clientHeight;
    if (target > limit) target = limit;

    var start = outerScrollContainer.scrollTop;

    var dist = target - start;
    var duration = 300 + (300 * dist) / 100;
    var startTime = null;
    function step(time) {
      if (startTime == null) startTime = time;
      var t = (time - startTime) / duration;
      var lerp = 3 * t * t - 2 * t * t * t; // ease in/out
      outerScrollContainer.scrollTo(0, (1.0 - lerp) * start + lerp * target);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // The Y coordinate of the bottom end of all the story content, used
  // for growing the container, and deciding how far to scroll.
  function contentBottomEdgeY() {
    var bottomElement = storyContainer.lastElementChild;
    return bottomElement
      ? bottomElement.offsetTop + bottomElement.offsetHeight
      : 0;
  }

  // Remove all elements that match the given selector. Used for removing choices after
  // you've picked one, as well as for the CLEAR and RESTART tags.
  function removeAll(selector) {
    var allElements = storyContainer.querySelectorAll(selector);
    for (var i = 0; i < allElements.length; i++) {
      var el = allElements[i];
      el.parentNode.removeChild(el);
    }
  }

  // Used for hiding and showing the header when you CLEAR or RESTART the story respectively.
  function setVisible(selector, visible) {
    var allElements = storyContainer.querySelectorAll(selector);
    for (var i = 0; i < allElements.length; i++) {
      var el = allElements[i];
      if (!visible) el.classList.add("invisible");
      else el.classList.remove("invisible");
    }
  }

  // Helper for parsing out tags of the form:
  //  # PROPERTY: value
  // e.g. IMAGE: source path
  function splitPropertyTag(tag) {
    var propertySplitIdx = tag.indexOf(":");
    if (propertySplitIdx != null) {
      var property = tag.substr(0, propertySplitIdx).trim();
      var val = tag.substr(propertySplitIdx + 1).trim();
      return {
        property: property,
        val: val,
      };
    }

    return null;
  }

  // Loads save state if exists in the browser memory
  function loadSavePoint() {
    try {
      let savedState = window.localStorage.getItem("save-state");
      if (savedState) {
        story.state.LoadJson(savedState);
        return true;
      }
    } catch (e) {
      console.debug("Couldn't load save state");
    }
    return false;
  }

  // Detects which theme (light or dark) to use
  function setupTheme(globalTagTheme) {
    // load theme from browser memory
    var savedTheme;
    try {
      savedTheme = window.localStorage.getItem("theme");
    } catch (e) {
      console.debug("Couldn't load saved theme");
    }

    // Check whether the OS/browser is configured for dark mode
    var browserDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    if (
      savedTheme === "dark" ||
      (savedTheme == undefined && globalTagTheme === "dark") ||
      (savedTheme == undefined && globalTagTheme == undefined && browserDark)
    )
      document.body.classList.add("dark");
  }

  // Used to hook up the functionality for global functionality buttons
  function setupButtons(hasSave) {
    let rewindEl = document.getElementById("rewind");
    if (rewindEl)
      rewindEl.addEventListener("click", function (event) {
        removeAll("p");
        removeAll("img");
        setVisible(".header", false);
        restart();
      });

    let saveEl = document.getElementById("save");
    if (saveEl)
      saveEl.addEventListener("click", function () {
        updateSaveSlotList();
        document.getElementById("save-overlay").classList.remove("hidden");
      });

    let reloadEl = document.getElementById("reload");

    // 检查是否有存档
    try {
      const saves = JSON.parse(
        window.localStorage.getItem("save-slots") || "[]"
      );
      if (saves.length > 0) {
        reloadEl.removeAttribute("disabled");
      } else {
        reloadEl.setAttribute("disabled", "disabled");
      }
    } catch (e) {
      console.debug("Couldn't check saves");
      reloadEl.setAttribute("disabled", "disabled");
    }

    reloadEl.addEventListener("click", function () {
      updateLoadSlotList();
      document.getElementById("load-overlay").classList.remove("hidden");
    });

    let themeSwitchEl = document.getElementById("theme-switch");
    if (themeSwitchEl)
      themeSwitchEl.addEventListener("click", function (event) {
        document.body.classList.add("switched");
        document.body.classList.toggle("dark");
      });

    // 添加关闭按钮的事件监听
    document
      .querySelector("#save-overlay .close-button")
      .addEventListener("click", closeSaveOverlay);
    document
      .querySelector("#load-overlay .close-button")
      .addEventListener("click", closeLoadOverlay);
  }

  // 添加一个辅助函数来更新读取按钮状态
  function updateReloadButtonState() {
    const reloadEl = document.getElementById("reload");
    try {
      const saves = JSON.parse(
        window.localStorage.getItem("save-slots") || "[]"
      );
      if (saves.length > 0) {
        reloadEl.removeAttribute("disabled");
      } else {
        reloadEl.setAttribute("disabled", "disabled");
      }
    } catch (e) {
      console.debug("Couldn't check saves");
      reloadEl.setAttribute("disabled", "disabled");
    }
  }

  // 添加新的函数用于处理存档
  function saveToSlot(slotIndex) {
    try {
      // 获取现有存档
      saveSlots = JSON.parse(window.localStorage.getItem("save-slots") || "[]");

      // 创建新的存档数据
      const saveData = {
        savePoint: savePoint,
        timestamp: new Date().toISOString(),
        theme: document.body.classList.contains("dark") ? "dark" : "",
        isSingleSentenceModeEnabled: isSingleSentenceModeEnabled,
        // 添加 BGM 相关状态
        bgm: {
          isPlaying: isBgmPlaying(),
          src: getBgmSrc(),
        },
      };

      // 更新指定位置的存档
      saveSlots[slotIndex] = saveData;

      // 保存回 localStorage
      window.localStorage.setItem("save-slots", JSON.stringify(saveSlots));

      // 更新读取按钮状态
      updateReloadButtonState();

      // 关闭存档界面
      closeSaveOverlay();
    } catch (e) {
      console.warn("Couldn't save state", e);
    }
  }

  // 添加新的函数用于处理读档
  async function loadFromSlot(slotIndex) {
    try {
      saveSlots = JSON.parse(window.localStorage.getItem("save-slots") || "[]");
      const saveData = saveSlots[slotIndex];

      if (saveData) {
        removeAll("p");
        removeAll("img");

        story.state.LoadJson(saveData.savePoint);

        // 设置主题
        if (saveData.theme === "dark") {
          document.body.classList.add("dark");
        } else {
          document.body.classList.remove("dark");
        }

        // 恢复单句模式状态
        isSingleSentenceModeEnabled =
          saveData.isSingleSentenceModeEnabled || false;

        // 恢复 BGM 状态
        if (saveData.bgm) {
          if (saveData.bgm.src) {
            playBgm(saveData.bgm.src);
            if (!saveData.bgm.isPlaying) {
              pauseBgm();
            }
          } else {
            stopBgm();
          }
        }

        // 如果需要刷新随机数，则刷新
        if (refreshRandomSeedWhenLoad) {
          story.state.storySeed = new Date().getTime() % 100;
          story.state.previousRandom = 0;
        }

        await continueStory(true);

        // 关闭读档界面
        closeLoadOverlay();
      }
    } catch (e) {
      console.debug("Couldn't load save state", e);
    }
  }

  // 修改关闭对话框的函数
  function closeSaveOverlay() {
    const overlay = document.getElementById("save-overlay");
    overlay.classList.add("fade-out");
    setTimeout(() => {
      overlay.classList.add("hidden");
      overlay.classList.remove("fade-out");
    }, 200);
  }

  function closeLoadOverlay() {
    const overlay = document.getElementById("load-overlay");
    overlay.classList.add("fade-out");
    setTimeout(() => {
      overlay.classList.add("hidden");
      overlay.classList.remove("fade-out");
    }, 200);
  }

  // 添加 ESC 键关闭功能
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      const saveOverlay = document.getElementById("save-overlay");
      const loadOverlay = document.getElementById("load-overlay");

      if (!saveOverlay.classList.contains("hidden")) {
        closeSaveOverlay();
      }
      if (!loadOverlay.classList.contains("hidden")) {
        closeLoadOverlay();
      }
    }
  });

  // 添加点击遮罩关闭功能
  document.addEventListener("click", function (event) {
    if (event.target.classList.contains("modal-overlay")) {
      if (event.target.id === "save-overlay") {
        closeSaveOverlay();
      } else if (event.target.id === "load-overlay") {
        closeLoadOverlay();
      }
    }
  });

  // 更新存档列表显示
  function updateSaveSlotList() {
    const saveSlotList = document.getElementById("save-slot-list");
    saveSlotList.innerHTML = ""; // 清空现有内容

    // 获取现有存档
    const saves = JSON.parse(window.localStorage.getItem("save-slots") || "[]");

    // 显示现有存档
    saves.forEach((save, index) => {
      const slot = document.createElement("div");
      slot.className = "save-slot";

      const date = new Date(save.timestamp);
      const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")} ${date
        .getHours()
        .toString()
        .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

      slot.innerHTML = `
                <div class="slot-content">
                    <div class="number">存档 ${index + 1}</div>
                    <div class="content">存档时间: ${formattedDate}</div>
                    <div class="time"></div>
                </div>
                <button class="delete-button">×</button>
            `;

      // 使用事件委托处理点击事件
      const slotContent = slot.querySelector(".slot-content");
      slotContent.addEventListener("click", () => saveToSlot(index));

      const deleteButton = slot.querySelector(".delete-button");
      deleteButton.addEventListener("click", (event) => {
        event.stopPropagation();
        confirmDeleteSlot(index, true);
      });

      saveSlotList.appendChild(slot);
    });

    // 添加"创建新存档"按钮
    const newSlot = document.createElement("div");
    newSlot.className = "save-slot new-save";
    newSlot.innerHTML = `
            <div class="slot-content">
                <div class="number">新存档</div>
                <div class="content">创建新的存档</div>
                <div class="time"></div>
            </div>
        `;
    newSlot.addEventListener("click", () => saveToSlot(saves.length));

    saveSlotList.appendChild(newSlot);
  }

  // 更新读档列表显示
  function updateLoadSlotList() {
    const loadSlotList = document.getElementById("load-slot-list");
    loadSlotList.innerHTML = ""; // 清空现有内容

    // 获取现有存档
    const saves = JSON.parse(window.localStorage.getItem("save-slots") || "[]");

    if (saves.length === 0) {
      const emptyNotice = document.createElement("div");
      emptyNotice.className = "empty-notice";
      emptyNotice.textContent = "没有找到任何存档";
      loadSlotList.appendChild(emptyNotice);
      return;
    }

    // 显示所有存档
    saves.forEach((save, index) => {
      const slot = document.createElement("div");
      slot.className = "save-slot";

      const date = new Date(save.timestamp);
      const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")} ${date
        .getHours()
        .toString()
        .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

      slot.innerHTML = `
                <div class="slot-content">
                    <div class="number">存档 ${index + 1}</div>
                    <div class="content">存档时间: ${formattedDate}</div>
                    <div class="time"></div>
                </div>
                <button class="delete-button">×</button>
            `;

      // 使用事件委托处理点击事件
      const slotContent = slot.querySelector(".slot-content");
      slotContent.addEventListener("click", () => loadFromSlot(index));

      const deleteButton = slot.querySelector(".delete-button");
      deleteButton.addEventListener("click", (event) => {
        event.stopPropagation();
        confirmDeleteSlot(index, false);
      });

      loadSlotList.appendChild(slot);
    });
  }

  // 添加删除存档的确认和执行函数
  function confirmDeleteSlot(index, isSaveList) {
    if (confirm(`确认要删除存档 ${index + 1} 吗？`)) {
      try {
        let saves = JSON.parse(
          window.localStorage.getItem("save-slots") || "[]"
        );
        saves.splice(index, 1);
        window.localStorage.setItem("save-slots", JSON.stringify(saves));

        // 更新界面
        if (isSaveList) {
          updateSaveSlotList();
        } else {
          updateLoadSlotList();
        }

        // 更新读取按钮状态
        updateReloadButtonState();
      } catch (e) {
        console.warn("Couldn't delete save", e);
      }
    }
  }

  // 修改 addSingleSentenceHint 函数
  function addSingleSentenceHint(delay = 400) {
    return new Promise((resolve) => {
      removeSingleSentenceHint();
      if (story.canContinue) {
        setTimeout(function () {
          var hint = document.createElement("p");
          hint.innerText = "▽";
          hint.id = "single-sentence-hint";
          storyContainer.appendChild(hint);
          hint.classList.add("blink");

          // 使用 requestAnimationFrame 确保元素已被渲染
          requestAnimationFrame(() => {
            // 滚动到提示元素可见
            scrollDown(contentBottomEdgeY());
          });

          // 添加一次性点击事件监听器
          const clickHandler = () => {
            removeSingleSentenceHint();
            storyContainer.removeEventListener("click", clickHandler);
            resolve();
          };

          storyContainer.addEventListener("click", clickHandler);
        }, delay);
      } else {
        resolve();
      }
    });
  }

  // 修改 removeSingleSentenceHint 函数，确保只移除提示元素
  function removeSingleSentenceHint() {
    var hint = document.getElementById("single-sentence-hint");
    if (hint) {
      hint.parentElement.removeChild(hint);
    }
  }

  // 显示一个输入框，用于输入数据
  function addInputBox(variableName, delay = 400) {
    return new Promise((resolve) => {
      setTimeout(function () {
        // 移除已存在的输入框（如果有）
        var existingInput = document.getElementById("input-container");
        if (existingInput) {
          existingInput.parentElement.removeChild(existingInput);
        }

        // 创建输入框容器
        var container = document.createElement("div");
        container.id = "input-container";

        // 创建输入框
        var inputBox = document.createElement("input");
        inputBox.id = "input-box";
        inputBox.type = "text";
        inputBox.placeholder = "请在此输入...";

        // 创建确定按钮
        var submitButton = document.createElement("button");
        submitButton.id = "input-submit";
        submitButton.textContent = "确定";

        // 处理提交
        function handleSubmit() {
          var inputValue = inputBox.value.trim();
          if (inputValue) {
            // 将输入值保存到 ink 变量中
            if (variableName) {
              story.variablesState[variableName] = inputValue;
            }

            // 移除输入框容器
            if (container && container.parentElement) {
              container.parentElement.removeChild(container);
            }

            // 解析 Promise
            resolve();
          }
        }

        // 添加点击事件
        submitButton.addEventListener("click", handleSubmit);

        // 将输入框和按钮添加到容器中
        container.appendChild(inputBox);
        container.appendChild(submitButton);

        storyContainer.appendChild(container);

        // 自动聚焦到输入框
        inputBox.focus();
      }, delay);
    });
  }

  // 隐藏背景图
  function hideBg() {
    let bgImg = document.getElementById("bg_img");
    if (bgImg) {
      bgImg.style.visibility = "hidden";
    }
  }

  // 显示背景图
  function showBg(src) {
    let bgImg = document.getElementById("bg_img");
    if (bgImg) {
      bgImg.onload = function () {
        bgImg.style.visibility = "visible";
      };
      bgImg.src = src;
    }
  }

  // 播放背景音乐
  function playBgm(src) {
    console.log("play bgm: " + src);
    if ("bgm" in this) {
      this.bgm.pause();
      this.bgm.removeAttribute("src");
      this.bgm.load();
    }

    this.bgm = new Audio(src);
    this.bgm.play();
    this.bgm.loop = true;
  }

  // 继续播放背景音乐
  function resumeBgm() {
    console.log("resume bgm");
    if ("bgm" in this) {
      this.bgm.play();
    }
  }

  // 暂停背景音乐
  function pauseBgm() {
    console.log("pause bgm");
    if ("bgm" in this) {
      this.bgm.pause();
    }
  }

  // 停止背景音乐
  function stopBgm() {
    console.log("stop bgm");
    if ("bgm" in this) {
      this.bgm.pause();
      this.bgm.load();
      this.bgm.loop = true;
    }
  }

  // 判断背景音乐是否正在播放
  function isBgmPlaying() {
    if ("bgm" in this) {
      return !this.bgm.paused;
    }
    return false;
  }

  // 获取背景音乐的 src
  function getBgmSrc() {
    if ("bgm" in this) {
      return this.bgm.src;
    }
    return undefined;
  }
})(storyContent);
