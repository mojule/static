# static

mojule static site generator

prototype/experiments

## Install

`npm install @mojule/xxx`

## Example

```javascript
```

## steps

1. Read fs to vfs
2. Find component tree .mmon/.json files to determine routes
3. Transform each into html and replace in vfs
4. Write vfs to fs

Also:

Collect the routes and make them available in a model so user can do things like
generate navs from the routes if they wish. Given the tree nature of the model
(individual components are kinda siloised) this might not be trivial

Provide a way to allow users to turn models into routes, eg a product catalogue
into a series of product pages

### strategy

- Ignore ability for custom head and body for now
- Ignore models -> routes
- Ignore autogenerating navigation
- Get current Crozier site working
