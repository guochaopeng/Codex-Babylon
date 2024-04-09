require("dotenv").config();
//import fetch from "isomorphic-fetch";
import fetch from 'node-fetch';
import {HttpProxyAgent} from 'http-proxy-agent';
//import {HttpsProxyAgent} from 'https-proxy-agent';
// Contains the helper methods for interacting with Codex and crafting model prompts
import { baseContext } from "./contexts/context1";
import Context from "./Context";
import { detectSensitiveContent, detectSensitiveContent_curl } from "./contentFiltering";

import { Curl, CurlFeature } from 'node-libcurl';

const maxPromptLength = 3200;

// CURRENTLY SINGLE TENANT - WOULD NEED TO UPDATE THIS TO A MAP OF TENANT IDs TO PROMPTS TO MAKE MULTI-TENANT
export const context = new Context(baseContext);

// 设置代理服务器
// 使用node-fetch来添加代理的方式;
const agent = new HttpProxyAgent(`${process.env.PROXY_URL}`);

interface CustomRequestInit extends RequestInit {
    agent?: any; // Update the type of 'agent' as per your requirements
}

//使用curl;
export function getCompletion_curl(command: string) : Promise<any>{   
    let prompt = context.getPrompt(command);

    if (prompt.length > maxPromptLength) {
        context.trimContext(maxPromptLength - command.length + 6); // The max length of the prompt, including the command, comment operators and spacing.
    }

    const curl = new Curl();
    curl.setOpt('URL', 'https://api.openai.com/v1/completions');
    curl.setOpt(Curl.option.POST, 1);
    curl.setOpt(Curl.option.HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer `${process.env.OPENAI_API_KEY}`'
    ]);
    curl.setOpt(Curl.option.POSTFIELDS, JSON.stringify({
        model: "gpt-3.5-turbo-instruct",
        prompt: prompt,
        max_tokens: 800,
        temperature: 0,
        stop: "/*",
        n: 1        
    }));

    curl.setOpt(Curl.option.SSL_VERIFYPEER, false);
    curl.setOpt(Curl.option.SSL_VERIFYHOST, false);

    curl.setOpt(Curl.option.PROXY, 'http://127.0.0.1:9910');
    curl.perform();

    return new Promise((resolve,reject) => {
        curl.on('end', async function(statusCode, data, headers) {
            console.log(statusCode);
            console.log( "--cur is running:" + curl.isRunning);
            
            const response = JSON.parse(data.toString())
            let code = response.choices[0].text;
        
            console.log(code);
            
            let sensitiveContentFlag = await detectSensitiveContent_curl(command + "\n" + code);

            console.log(sensitiveContentFlag);
            // The flag can be 0, 1 or 2, corresponding to 'safe', 'sensitive' and 'unsafe'
            if (sensitiveContentFlag > 0) {
                console.warn(
                    sensitiveContentFlag === 1
                    ? "Your message or the model's response may have contained sensitive content."
                    : "Your message or the model's response may have contained unsafe content."
                );
        
                code = '';
            }
            else {
                //only allow safe interactions to be added to the context history
                context.addInteraction(command, code);
            }    
            this.close();
            resolve({ code, prompt, sensitiveContentFlag });
        });

        curl.on('error', function(error,curcode,curlinstance) {
            console.log(error);
            console.log("--cur is running:" + curl.isRunning);
            this.close();
            reject(error);
        });
    })
}


export async function getCompletion(command: string) {      
    let prompt = context.getPrompt(command);

    if (prompt.length > maxPromptLength) {
        context.trimContext(maxPromptLength - command.length + 6); // The max length of the prompt, including the command, comment operators and spacing.
    }

    const customRequestInit ={
        method: "POST",
        agent:agent,
        headers: {
            'Content-Type': "application/json",
            'Authorization': "Bearer `${process.env.OPENAI_API_KEY}`",
        },
        mode:'cors',
        body: JSON.stringify({
            prompt,
            max_tokens: 800,
            temperature: 0,
            stop: "/*",
            n: 1
        })
    };

    const response = await fetch(`https://api.openai.com/v1/engines/${process.env.OPENAI_ENGINE_ID}/completions`, customRequestInit);
    // catch errors  
    if (!response.ok) {
        console.log("fetch status:" + response.status);

        const error = `There is an issue with your OpenAI credentials, please check your OpenAI API key, organization ID and model name. Modify the credentials and restart the server!`;
        if (response.status == 404){
            console.log(error);
        }
        return {error};
    }

    const json = await response.json();
    let code = json.choices[0].text;

    let sensitiveContentFlag = await detectSensitiveContent(command + "\n" + code);

    // The flag can be 0, 1 or 2, corresponding to 'safe', 'sensitive' and 'unsafe'
    if (sensitiveContentFlag > 0) {
        console.warn(
            sensitiveContentFlag === 1
            ? "Your message or the model's response may have contained sensitive content."
            : "Your message or the model's response may have contained unsafe content."
        );

        code = '';
    }
    else {
        //only allow safe interactions to be added to the context history
        context.addInteraction(command, code);
    }    

    return {
        code,
        prompt,
        sensitiveContentFlag
    };    
}