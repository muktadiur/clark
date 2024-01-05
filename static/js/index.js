class ChatLLM {
  constructor() {
    this.BASE_URL = "http://localhost:8000";
    this.chatContainer = document.querySelector("#chat-container");
    this.filesContainer = document.querySelector("#filesContainer");
    this.questionInput = document.querySelector(".question-input");
    this.questionSpinner = document.querySelector(".question-spinner");
    this.headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  async displayMessage(actor, message, typingSpeed = 20) {
    let index = 0;
    let currentMessage = `${actor}: ${message}`;
    this.chatContainer.innerHTML += "<br>";

    return new Promise((resolve) => {
      const typeMessage = () => {
        if (index < currentMessage.length) {
          const ch = currentMessage[index];
          if (ch.charCodeAt(0) === 10) {
            this.chatContainer.innerHTML += "<br>";
          } else {
            this.chatContainer.innerHTML += currentMessage[index];
          }
          index++;
          setTimeout(typeMessage, typingSpeed);
        } else {
          this.chatContainer.innerHTML += "<br>";
          this.clearQuestionInput();
          this.enableQuestionInput();
          this.hideSpinner();
          resolve();
        }
        window.scrollTo(0, document.body.scrollHeight);
      };
      typeMessage();
    });
  }

  async askQuestion(query) {
    await this.displayMessage("You", query, 5);
    this.disableQuestionInput();
    this.showSpinner();
    try {
      const response = await fetch(`${this.BASE_URL}/completions`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ message: query }),
      });
      let answer = await response.json();
      await this.displayMessage("Clark", answer.content);
    } catch (error) {
      console.error(error);
    }
  }

  // async removeFile(fileName) {
  //   let response = await fetch(`${this.BASE_URL}/delete_file/`, {
  //     method: "POST",
  //     headers: this.headers,
  //     data: JSON.stringify(fileName),
  //   });
  //   console.log(await response.json());
  // }

  async loadFiles() {
    if (!this.filesContainer) return;
    try {
      const response = await fetch(`${this.BASE_URL}/files`);
      const files = await response.json();
      this.filesContainer.innerHTML = "";
      files.forEach((file) => {
        this.filesContainer.innerHTML += `
        <li>
          <span class="file">${file}</span>
          <button class="delete-button" style="display: none;">x</button>
        </li>`;
      });
      const listItems = this.filesContainer.getElementsByTagName("li");
      for (let i = 0; i < listItems.length; i++) {
        listItems[i].addEventListener("mouseover", function () {
          this.getElementsByClassName("delete-button")[0].style.display =
            "inline-block";
        });
        listItems[i].addEventListener("mouseout", function () {
          this.getElementsByClassName("delete-button")[0].style.display =
            "none";
        });
        self = this;
        listItems[i].addEventListener("click", async function () {
          let fileName = this.querySelector("span.file").textContent;
          try {
            await fetch(`${self.BASE_URL}/delete_file/`, {
              method: "POST",
              headers: self.headers,
              body: JSON.stringify({ file_name: fileName }),
            });
            self.loadFiles();
          } catch (error) {
            console.log(error);
          }
        });
      }
    } catch (error) {
      console.error(error);
    }
  }

  clearQuestionInput() {
    this.questionInput.value = "";
  }

  disableQuestionInput() {
    this.questionInput.disabled = true;
  }

  enableQuestionInput() {
    this.questionInput.disabled = false;
  }

  hideSpinner() {
    this.questionSpinner.style.display = "none";
  }

  showSpinner() {
    if (!this.questionSpinner) return;
    this.questionSpinner.style.display = "inline-block";
  }

  async processFiles() {
    if (!this.questionInput) return;
    this.showSpinner();
    try {
      await fetch(`${this.BASE_URL}/process`, {
        method: "POST",
        headers: this.headers,
      });
      setTimeout(() => {
        this.hideSpinner();
        this.enableQuestionInput();
      }, 5000)
    } catch (error) {
      console.error(error);
    }


  }

  async uploadFiles(event) {
    const formData = new FormData();
    Array.from(event.target.files).forEach((file) => {
      formData.append("files", file);
    });
    try {
      await fetch(`${this.BASE_URL}/upload_files`, {
        method: "post",
        enctype: "multipart/form-data",
        body: formData,
      });
      this.loadFiles();
    } catch (error) {
      console.error(error);
    }
  }

  load() {
    this.loadFiles();
    this.hideSpinner();
    this.enableQuestionInput();
    if (!this.questionInput) return;
    this.questionInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.askQuestion(this.questionInput.value);
      }
    });
  }

  completions() {
    this.askQuestion(this.questionInput.value);
  }

  handleFileChange(event) {
    this.uploadFiles(event);
  }

  handleFileProcess() {
    this.processFiles();
  }
}

const chatLLM = new ChatLLM();
window.addEventListener("load", () => chatLLM.load());
