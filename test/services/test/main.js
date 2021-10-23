const express = require("express");

const portNumber = Number(process.argv[2]);

if (!portNumber) {
  console.error("There is no third argument!");
  process.exit(1);
}

var app = express();
app.get("*", (request, response) => {
  response.status(200).json({
    method: "GET",
    url: request.path,
  });
});
app.post("*", (request, response) => {
  response.status(200).json({
    method: "POST",
    url: request.path,
    body: request.body,
  });
});
app.patch("*", (request, response) => {
  response.status(200).json({
    method: "PATCH",
    url: request.path,
    body: request.body,
  });
});
app.put("*", (request, response) => {
  response.status(200).json({
    method: "PUT",
    url: request.path,
    body: request.body,
  });
});
app.delete("*", (request, response) => {
  response.status(200).json({
    method: "DELETE",
    url: request.path,
  });
});
app.options("*", (request, response) => {
  response.status(204);
});

app.listen(portNumber, () => {
  console.log("Started at localhost:" + portNumber);
});
