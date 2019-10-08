# Sign In with Apple Tools

## Config file

1. Copy `.env.example` to `whatever.env`
2. Change configuration values in `whatever.env` to match your Apple and Auth0 configuration

Tip: You can have multiple configuration files to combine different Auth0 and Apple IDs + Signing Certificates combinations

## Running the script

1. Run with `node index.js whatever.env`
2. By default, the script generates the `client_secret` that you need to call the [Apple SIWA API](https://developer.apple.com/documentation/signinwithapplerestapi/generate_and_validate_tokens). This token is not used to call the Auth0 Authorization API
3. Choose how you want to exchange a code
4. Paste the authorization code, and wait for the token exchange to complete

## Obtaining authorization codes

To obtain codes to test the token exchange flow:

1. Download Auth0's [ios-swift-siwa quickstart](https://auth0.com/docs/quickstart/native/ios-swift-siwa)
2. Follow the instructions to obtain [all prerequisites](https://auth0.com/docs/quickstart/native/ios-swift-siwa#before-you-start)
3. Make sure Auth0.plist has the correct tenant and client information
4. On `ViewController.swift`, comment out the call to Auth0, starting on line 144
5. Add a `print(authCode);` statement to log the code obtained by the app after the Sign In with Apple is successful
6. Run the emulator, click "Sign In with Apple", follow the authentication flow
7. Once the flow completes, check XCode's logger to get your code