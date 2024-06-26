import express from "express";
import path from "path";
import { context, getCompletion,getCompletion_curl} from "./model";
import { createProxyMiddleware } from "http-proxy-middleware";
import cors from "cors";
import http from 'http';


const app = express();
app.use(express.json());
app.use(express.static(__dirname + "/public"));


const port = process.env.SERVER_PORT;
app.use(cors({ origin: `http://localhost:${process.env.CLIENT_PORT}` }));

app.get("/", (_req, res) => {
    res.sendFile(path.join(__dirname, "/index.html"));
});

// Gets natural language and returns code
app.post("/codegen", async (req, res) => {
    console.log(`Received natural language command: '${req.body.text}'`);
    const response = await getCompletion_curl(req.body.text);
    res.send(JSON.stringify(response));
});

// Gets natural language and returns code
app.get("/reset", async (_req, res) => {
    context.resetContext();
    res.send(
        JSON.stringify({
            context: context.getContext()
        })
    );
});

app.listen(port, () => {
    console.log(`Codex Babylon webapp listening at http://localhost:${port}`);
});
