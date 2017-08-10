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

Collect the styles and client scripts for each page - create a shared css/js for
those used on more than one page and per-page ones for those used only on a
page. Is there css/js that expects to be provided in a certain order? Also how
do we deal with things like Google maps API and others that use async/defer and
need to be included *after* client scripts?

Components no longer generate document elements - because browser DOM, JSDOM et
al can't really parse a document from a string. For each page, generate an HTML
document that links in the above but also allow the user to define what the head
and body will look like - should this be done as a global head/body? How does
the user override these on certain pages?

### strategy

- Ignore ability for custom head and body for now
- Ignore analysing css/js - just concat into one big file for each and use them
  on every page
- Ignore models -> routes
- Ignore autogenerating navigation
- Get current Crozier site working
- Sticking point may be the Google Maps thing - think about how to solve this
  at this stage