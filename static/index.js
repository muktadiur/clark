class ChatLLM {
  constructor() {
    this.BASE_URL = "http://localhost:8000";
    this.chatContainer = document.querySelector("#chat-container");
    this.filesContainer = document.querySelector('#filesContainer');
    this.questionInput = document.querySelector('.question-input');
    this.questionSpinner = document.querySelector('.question-spinner');
    this.questionSpinnerMessage = document.querySelector('.question-spinner-message');
    this.typingSpeed = 50;
    this.headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
  }

  async displayMessage(actor, message) {
    let index = 0;
    let currentMessage = `${actor}: ${message}`;
    this.chatContainer.innerHTML += "<br>";
    const typeMessage = () => {
      if (index < currentMessage.length) {
        const ch = currentMessage[index];
        if (ch.charCodeAt(0) === 10) {
          this.chatContainer.innerHTML += "<br>";
        } else {
          this.chatContainer.innerHTML += currentMessage[index];
        }
        index++;
        setTimeout(typeMessage, this.typingSpeed);
      } else {
        this.chatContainer.innerHTML += "<br>";
        index++;
        return "done"
      }
    }
    typeMessage();
  }

  async loadFiles() {
    if (!this.filesContainer) return;
    try {
      const response = await fetch(`${this.BASE_URL}/files`);
      const files = await response.json();
      this.filesContainer.innerHTML = "";
      files.forEach(file => {
        this.filesContainer.innerHTML += `<li>${file}</li>`;
      });
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
    this.questionSpinnerMessage.style.display = "none";
  }

  showSpinner() {
    if (!this.questionSpinner || !this.questionSpinnerMessage) return;
    this.questionSpinnerMessage.style.display = "block";
    this.questionSpinner.style.display = "inline-block";
  }

  async askQuestion(query) {
    await this.displayMessage('You', query);
    this.clearQuestionInput();
    this.disableQuestionInput();
    try {
      const response = await fetch(`${this.BASE_URL}/ask`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({"message": query})
      });
      let answer = await response.json();
      await this.displayMessage('Clark', answer.content);
      this.enableQuestionInput();
    } catch (error) {
      console.error(error);
    }
  }

  async processFiles() {
    if (!this.questionInput) return;
    this.showSpinner();
    try {
      await fetch(`${this.BASE_URL}/process`, {
        method: 'POST',
        headers: this.headers
      });
      this.enableQuestionInput();
    } catch (error) {
      console.error(error);
    }
    this.hideSpinner();
  }

  async uploadFiles(event) {
    const formData = new FormData();
    Array.from(event.target.files).forEach(file => {
      formData.append('files', file);
    });
    try {
      await fetch(`${this.BASE_URL}/uploadfiles`, {
        method: "post",
        enctype: "multipart/form-data",
        body: formData
      });
      this.loadFiles();
    } catch (error) {
      console.error(error);
    }
  }

  load() {
    this.loadFiles();
    this.processFiles();
    if (!this.questionInput) return;
    this.questionInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.askQuestion(this.questionInput.value);
      }
    });
  }

  ask() {
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