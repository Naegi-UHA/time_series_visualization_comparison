const methodOptions = document.querySelector(".method-options");
const currentMethod = document.getElementById("current-method");

methodOptions.addEventListener("click", (event) => {
    if (event.target.matches("button")) {
        currentMethod.textContent = `current method : ${event.target.textContent}`;
        methodOptions.closest(".method-selector").open = false;
    }
});
