const messages = [
    "Hello!",
    "This is clark.",
    "How can I assist you?",
    "Feel free to ask questions."
  ];
  
  
  function displayMessages() {
    const chatContainer = document.getElementById("chat-container");
  
    let index = 0;
    let messageIndex = 0;
    let typingSpeed = 50;
  
    function typeMessage() {
      if (messageIndex === messages.length) {
        return;
      }
  
      const currentMessage = messages[messageIndex];
      if (index < currentMessage.length) {
        const newChar = document.createTextNode(currentMessage[index]);
        chatContainer.appendChild(newChar);
        index++;
      } else {
        chatContainer.appendChild(document.createElement("br"));
        index = 0;
        messageIndex++;
      }
  
      setTimeout(typeMessage, typingSpeed);
    }
  
    typeMessage();
  }
  
  
  window.addEventListener("load", displayMessages);
  
  