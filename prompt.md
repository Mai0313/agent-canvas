## Project Description

LLM Chatbot Frontend UI

- 這個專案是使用 `React` 和 `TypeScript` 開發 並透過 `yarn` 進行套件管理
  - 你不需要編輯 `package.json` 你也不需要執行安裝套件的命令 你只需要提醒我安裝你需要的套件

## Supporting Features

- 當使用者任務是寫代碼時
  - 右邊會彈出一個 `markdown editor` a.k.a `MarkdownCanvas`
  - 當第一個 "\`\`\`" 出現時開始計算行數, 當出現第五行時就自動把整個代碼框透過 `Streaming`
    的方式輸出到 `MarkdownCanvas` 內
  - 當第二個 "\`\`\`" 出現時 就會停止渲染到 `MarkdownCanvas` 將後續內容輸出到 `ChatBox`
- MarkdownCanvas 和 ChatBox 之間會有一個 `ResizeBox` 用於給使用者調整每一區塊的大小
- 當使用者框選出一段文字後
  - 會有一個 `ContextMenu` 彈出來
  - 當使用者點擊 `Ask GPT` 時會將選取的文字傳給 `ChatBox` 並且等待使用者輸入問題後送出
- 當收到使用者訊息後 會透過 `chatCompletion` 來判斷任務內容
  - `canvas`
    - `canvas` 模式下 原本 `chat` 會被拆成兩個 `chatCompletion` 但 輸出的結果會跟 `chat` 模式一樣
    - 當 `taskType === "canvas"` 的時候 會觸發兩個chat completion
      - 第一個 `chatCompletion`
        會先將user的問題放進去 並讓LLM只能透過一個代碼框來回答問題 並且 將這段用 `streaming`
        的方式寫入 `MarkdownCanvas`
      - 當上述完成以後 將問題與生成完畢的代碼框一起放進第二個 `chatCompletion` 來生成後續的描述
      - 這兩個 `chatCompletion` 將會同時進行並且輸出在同一個 `ChatBox` 內 保持與 `chat`
        模式相同的行為
  - `image`
    - 生圖模式會透過 `generateImageAndText` 來產生圖片與對應的文字
    - 當圖片生成完畢後會同時與文字渲染到 `ChatBox`
    - 先透過 `generateImageAndText` 來產生圖片 圖片產生以後會將 `imageUrl` 放進 `chatCompletion`
      來生成對應的圖片敘述
  - `chat`
    - 透過代碼框的方式來偵測是否需要進入 `MarkdownCanvas` 模式
    - 當偵測到第一個代碼框時 會開始將後續代碼透過 `Streaming` 的方式輸出到 `MarkdownCanvas` 內
- 每一段 LLM 的回應下方新增幾個按鈕
  - `Copy`
    - 當使用者點擊這個按鈕時 會將該段回應的內容複製到剪貼簿
  - `Edit`
    - 當使用者點擊這個按鈕時 會將該段回應變成可編輯狀態 並且有額外一個 Send 按鈕 讓使用者修改以後點選送出
    - 當使用者編輯完畢後 點擊 `Send` 按鈕會將編輯後的內容送出
  - `Delete`
    - 當使用者點擊這個按鈕時 會將該段回應刪除
  - `Regenerate`
    - 當使用者點擊這個按鈕時 會將該段對話刪除 並重新生成一次對話
    - 當使用者編輯完畢後 點擊 `Send` 按鈕會將編輯後的內容送出
- 使用者可以透過電腦的ctrl + v 來貼上圖片 貼上以後要送進chat completion

## TODO Features

- 幫我把這段功能

```
          <button onClick={toggleRawView} className='title-button' style={{ marginLeft: "8px" }}>
            {isRawView ? "編輯器視圖" : "原始視圖"}
          </button>
```

這段功能有一個不錯的地方 就是當我點 原始視圖的時候 `MarkdownCanvas` 會變成可被編輯的狀態

- 但這個功能目前是獨立的 我希望可以將這個功能整合進去 `Edit` 和 `保存` 的按鈕裡面
- 當使用者點擊 `Edit` 按鈕時 `MarkdownCanvas` 會變成可被編輯的狀態 也就是 `原始視圖` 的狀態
- 當使用者點擊 `保存` 按鈕時 `MarkdownCanvas` 會變成不可被編輯的狀態 也就是 `編輯器視圖` 的狀態
- 當使用者有透過編輯 編輯過 `MarkdownCanvas` 的內容時

  - 當使用者點擊 `保存` 按鈕時 會將編輯後的內容透過引用的方式 等待使用者填入問題 最後送進
    `chatCompletion` 並且將編輯後的內容渲染到 `MarkdownCanvas` 內
  - 當使用者點擊 `Cancel` 按鈕時 會將編輯後的內容丟棄 並且將編輯後的內容渲染到 `MarkdownCanvas` 內

- `MarkdownCanvas` 內 不知道為何渲染時並沒有因為他是 python 或是 markdown 而變色 或是 高亮

- 請幫我增加一個功能 當使用者用滑鼠把某段字反白時 希望可以跳出一個選項在反白的字下面
  - `Ask GPT`
    - 當使用者點擊這個選項時 彈出一個臨時的小視窗 那個小視窗是一個小型的chatbox 將反白的字當成引用 並讓user輸入他想問的問題但當實際調用
      `chatCompletion` 的時候 需要將Chatbox的所有對話紀錄 和 反白的字 和 使用者輸入的問題一起送給
      `chatCompletion` 讓他生成一段回覆回覆的部分要用streaming的方式生成在臨時的Chatbox
