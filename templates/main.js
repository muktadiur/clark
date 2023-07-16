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
    const response = await fetch(`${BASE_URL}/process`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    let questionInput = document.querySelector('.question-input');
    if (data.status === "sucess") {
      questionInput.style.display = "inline-block";
      hideSpinner();
      questionInput.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
          event.preventDefault();
          askQuestion(questionInput.value);
        }
      });
    } else {
      questionInput.style.display = "none";
      hideSpinner();
    }
    hideSpinner()
  }

  function hideSpinner() {
    let questionSpinner = document.querySelector('.question-spinner');
    let questionSpinnerMessage = document.querySelector('.question-spinner-message');
    questionSpinner.style.display = "none";
    questionSpinnerMessage.style.display = "none";
  }

  function showSpinner() {
    let questionSpinner = document.querySelector('.question-spinner');
    questionSpinner.style.display = "inline-block";
  }

  function load() {
    load_files();
    process_files();
  }
  
  
  window.addEventListener("load", load);
  
  