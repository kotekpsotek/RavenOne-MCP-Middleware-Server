1. Add these express routes below the verification middleware
```text
 * 1. Retrive the MCP servers list -> this is required for 2nd option option 'specific' route
 * 2. Retrive the MCP Server tools of 'specified' or 'all' mcp servers where: 'specified' and 'all' are the options
 * 3. Call the set of mcp tools with specified parameters and return the output to the caller. Take the mcp tools in list where can be one or multiple tools from multiple different mcp servers
```
2. Make the server dockerized and
3. Add the README.md with instructions how to config and use the server. 
    With isntructions for:
    - Docket
    - Github

    Mention:
    - config
    - setup to ravenone platform and how to accomplish it
4. Check for security the server cannot be sharing @backend package config in the dockerized version or dist
5. Make the library public
    - Github
    - Docket hub
