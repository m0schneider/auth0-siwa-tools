const fs = require("fs");
const dotenv = require("dotenv");
const jsonwebtoken = require('jsonwebtoken');
const inquirer = require('inquirer');
const request = require('request');
const chalk = require('chalk');
const url = require('url');
const querystring = require('querystring');

const configFilePath = process.argv[2];

if (configFilePath) {
    try {
        console.log('\n');
        console.log(chalk.cyan(`Loading config: ${chalk.yellow(configFilePath)}`));

        let configFile;

        try {
            configFile = fs.readFileSync(configFilePath);
        } catch (e) {
            return errorAndExit("Error: Config file can't be found.")
        }


        console.log(chalk.cyan('Parsing config file.'));
        const config = dotenv.parse(configFile);

        if (config.error) {
            console.log(config.error);
            process.exit(0);
        }

        console.log(chalk.cyan('Validating parameters in config file.'));
        validateConfig(config);

        console.log('\n');
        console.log(chalk.cyan('Generating client_secret.'));
        try {
            config.clientSecret = generateClientSecret(config);
            console.log(chalk.cyan(`Here's your client_secret: ${chalk.green(config.clientSecret)}`));

            let question = [
                {
                    type: 'list',
                    name: 'operation',
                    message: 'What would you like to do next?',
                    choices: [
                        { name: 'Token exchange with Auth0', value: 'txAuth0' },
                        { name: 'Token exchange with Apple', value: 'txApple' },
                        { name: 'Exit', value: 'exit' }
                    ]
                }
            ]

            console.log('\n');
            inquirer.prompt(question).then(answer => {
                if (answer.operation === 'exit') {
                    console.log('\n');
                    console.log(chalk.cyan('Self-destructing'));
                    console.log('\n');
                    process.exit(0);
                }

                let strategy = answer.operation;

                if (strategy === 'txApple') {
                    if(config.redirect_uri) {
                        console.log(chalk.green(getAppleAuthorizeURL(config)));
                    } else {
                        console.log(chalk.orange('If you want the Apple Authorize URL to be generated, define the redirect_uri in the config file'));
                    }
                }

                console.log('\n');
                inquirer.prompt([{
                    type: 'input',
                    message: "What's the authorization code? (ctrl+c to exit).",
                    name: 'code',
                    validate: (val) => {
                        return !!val; // make required
                    }
                }]).then(answer => {

                    let code = answer.code;

                    console.log('\n');
                    console.log(chalk.cyan(`Executing token exchange using ${chalk.yellow(strategy)}`));

                    tokenExchange(strategy, config, code, (err, res, body) => {
                        console.log(chalk.cyan('Token exchange completed'));
                        if (err) {
                            return errorAndExit("err");
                        }

                        console.log(chalk.cyan(`Exchange completed: ${chalk.green(body)}`));
                        console.log('\n');
                    });
                })

            })

        } catch (e) {
            console.log(`Error generating secret: ${e}`);
            process.exit(0);
        }

    } catch (e) {
        console.log(`Error: ${e}`);
    }
} else {
    console.log("Error: You must specify the path to the config file (ie. node index.js './myconfig.env'");
    process.exit(0);
}

function validateConfig(config) {
    ['clientId', 'teamId', 'signingKey', 'signingKeyId'].forEach(key => {
        if (!config[key])
            return missingConfigError(key);
    });

    function missingConfigError(key) {
        console.log(`Missing config key: ${key}`);
        process.exit(0);
    }
}

function generateClientSecret(config) {
    return jsonwebtoken.sign({
        iss: config.teamId, aud: 'https://appleid.apple.com', sub: config.clientId,
    }, config.signingKey, {
        headers: {
            kid: config.signingKeyId || undefined, // makes sure that '""' (empty string) or null doesn't make it to the header
        }, algorithm: 'ES256', expiresIn: '60m',
    });
}

function tokenExchange(strategy, config, code, cb) {

    switch (strategy) {
        case 'txAuth0':
            sendAuth0Request(config, code, cb);
            break;
        case 'txApple':
            sendAppleRequest(config, code, cb);
            break;
    }
}

function sendAuth0Request(config, code, cb) {
    if (!config.auth0Domain || !config.auth0ClientId) {
        // TODO: replace all errors with Error objects
        console.log('Error: No auth0 domain or auth0 client id found in config file.');
        return cb(new Error());
    }

    request.post(
        {
            url: `https://${config.auth0Domain}/oauth/token`,
            form: {
                subject_token: code,
                subject_token_type: 'http://auth0.com/oauth/token-type/apple-authz-code',
                grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
                client_id: config.auth0ClientId,
                scope: 'openid offline_access'
            }
        }
        , cb)
}

function sendAppleRequest(config, code, cb) {

    inquirer.prompt([{
        name: 'isWebFlow',
        message: 'Was this code obtained via Web Flow?',
        type: 'confirm'
    }]).then(answer => {
        let form = {
            client_id: config.clientId,
            client_secret: config.clientSecret,
            grant_type: "authorization_code",
            code: code
        }
    
        if (answer.isWebFlow) {
            form.redirect_uri = config.redirect_uri;
        }
    
        request.post(
            {
                url: 'https://appleid.apple.com/auth/token',
                form: form
            }, cb);
    })
}

function getAppleAuthorizeURL(config) {
    let authorizeUrl = new url.URL('https://appleid.apple.com/auth/authorize');

    let queryObj = {
        client_id: config.clientId,
        redirect_uri: config.redirect_uri,
        response_type: 'code',
        scope: 'email name',
        response_mode: 'form_post' // code can't be returned via other modes
    }

    authorizeUrl.search = querystring.stringify(queryObj);

    return authorizeUrl.href;
}

function errorAndExit(err) {
    console.log('\n');
    console.log(chalk.red(err));
    console.log('\n');
    process.exit(1);
}