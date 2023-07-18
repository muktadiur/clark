  const BASE_URL = "http://localhost:8000"

  function displayMessage(actor, message, typingSpeed, fnCallBack) {
    let index = 0;
    let currentMessage = `${actor}: ${message}`;
    const chatContainer = document.querySelector("#chat-container");
    typingSpeed = typingSpeed || 50;
    chatContainer.appendChild(document.createElement("br"));
    function typeMessage() {
      if (index < currentMessage.length) {
        const ch = currentMessage[index];
        if (ch.charCodeAt(0) === 10) {
          chatContainer.appendChild(document.createElement("br"));
        } else {
          const newChar = document.createTextNode(currentMessage[index]);
          chatContainer.appendChild(newChar);
        }
        index++;
        setTimeout(typeMessage, typingSpeed);
      } else {
        chatContainer.appendChild(document.createElement("br"));
        index++;
        if (fnCallBack) {
          fnCallBack();
        }
      }
    }
    typeMessage();
  }

  async function load_files() {
    const response = await fetch(`${BASE_URL}/files`);
    const files = await response.json();
    let filesContainer = document.querySelector('#filesContainer');
    filesContainer.innerHTML = "";
    for (let file of files) {
      let li = document.createElement('li');
      li.textContent = file
      filesContainer.appendChild(li);
    }
  }

  function clearQuestionInput() {
    let questionInput = document.querySelector('.question-input');
    questionInput.value = "";
  }

  function disabledQuestionInput() {
    let questionInput = document.querySelector('.question-input');
    questionInput.disabled = true;
  }

  function enableQuestionInput() {
    let questionInput = document.querySelector('.question-input');
    questionInput.disabled = false;
  }

  async function askQuestion(query) {
    displayMessage('You', query, 20);
    clearQuestionInput();
    disabledQuestionInput()
    const response = await fetch(`${BASE_URL}/ask`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({"message": query})
    });
    let answer = await response.json();
    displayMessage('Clark', answer.content, 60, enableQuestionInput);
  }

  async function process_files() {
    showSpinner();
    let questionInput = document.querySelector('.question-input');
    const response = await fetch(`${BASE_URL}/process`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    if (data.status === "success") {
      questionInput.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
          event.preventDefault();
          askQuestion(questionInput.value);
        }
      });
    }
    questionInput.disabled = false;
    hideSpinner()
  }

  async function uploadFiles(event) {
    const formData = new FormData();

    Array.from(event.target.files).forEach(file => {
      formData.append('files', file);
    });

    await fetch(`${BASE_URL}/uploadfiles`, {
      method: "post",
      enctype: "multipart/form-data",
      body: formData
    });

    load_files();
  }

  function hideSpinner() {
    let questionSpinner = document.querySelector('.question-spinner');
    let questionSpinnerMessage = document.querySelector('.question-spinner-message');
    questionSpinner.style.display = "none";
    questionSpinnerMessage.style.display = "none";
  }

  function showSpinner() {
    let questionSpinnerMessage = document.querySelector('.question-spinner-message');
    let questionSpinner = document.querySelector('.question-spinner');
    questionSpinnerMessage.style.display = "block";
    questionSpinner.style.display = "inline-block";
  }

  function load() {
    load_files();
    process_files();
  }

  function handleFileChange(event) {
    uploadFiles(event);
  }

  function handleFileProcess() {
    process_files();
  }
  
  
  window.addEventListener("load", load);
  
  