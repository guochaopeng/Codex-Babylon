import fetch from "isomorphic-fetch";
import { Curl, CurlFeature } from 'node-libcurl';

export function detectSensitiveContent_curl(content: string): Promise<number> {
    const curl = new Curl();
    curl.setOpt('URL', 'https://api.openai.com/v1/engines/content-filter-alpha/completions');
    curl.setOpt(Curl.option.POST, 1);
    curl.setOpt(Curl.option.HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer `${process.env.OPENAI_API_KEY}`'
    ]);
    curl.setOpt(Curl.option.POSTFIELDS, JSON.stringify({
        prompt: `<|endoftext|>[${content}]\n--\nLabel:`,
        temperature: 0,
        max_tokens: 1,
        top_p: 0,
        logprobs: 10,        
    }));

    curl.setOpt(Curl.option.SSL_VERIFYPEER, false);
    curl.setOpt(Curl.option.SSL_VERIFYHOST, false);

    curl.setOpt(Curl.option.PROXY, 'http://127.0.0.1:9910');
    curl.perform();

    return new Promise((resolve, reject) => {
        curl.on('end', async function(statusCode: number, body: string){
            //console.log( "body: " + body);
            const response = JSON.parse(body.toString())
    
            const filterFlag = response.choices[0].text as string;
            curl.close();
            resolve (parseInt(filterFlag) );
        });

        curl.on('error', function(error,curcode,curlinstance) {
            console.log(error);
            this.close();
            reject(error);
        });
    });
}

export async function detectSensitiveContent(content: string): Promise<number> {
    const response = await fetch('https://api.openai.com/v1/engines/content-filter-alpha/completions', {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "OpenAI-Organization": `${process.env.OPENAI_ORGANIZATION_ID}`
        },
        body: JSON.stringify({
            prompt: `<|endoftext|>[${content}]\n--\nLabel:`,
            temperature: 0,
            max_tokens: 1,
            top_p: 0,
            logprobs: 10,
        })
    });

    var json = await response.json();
    
    const filterFlag = json.choices[0].text as string;
    return parseInt(filterFlag);
}