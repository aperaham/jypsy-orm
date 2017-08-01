# Jypsy ORM

A Django-like PostgreSQL ORM for Node.  
Designed to closely mimic the syntax and usage of Django's ORM.  

Exclusively uses parameterized statement queries, which are not susceptible to SQL injection.  

  
Features:

    - filter
    - update
    - insert
    - delete
    - valuesList (select)
    - distinct
    - orderBy
    - sub queries
    - joins and reverse relations (in development)
    - models
    - fields

## Querying Examples

Filter:

```javascript
/* assumes 'People' model has been defined */

// filter for all people named 'Apple B' who are 21 years old
let people = People.orm.filter({name_first: 'Apple B', age: 21});

// get promise back from query request 
people.req().then(result => {
    // an array of objects
    console.log(results)
});
```


Distinct results:

```javascript
// find only 1 Apple B for each age
let people = People.orm.filter({name_first: 'Apple B'});

// orm functions return new objects and can be chained
let appleB = people.distinct('name_first', 'age');

appleB.req().then(result => {
    // returns an array of Apple's by distinct age
    console.log(result);
});
```

Select only specific fields:

```javascript
let juniors = Students.orm.filter({age: 16, graduated: false});

// 'SELECT' only name_first and name_last fields
juniors = juniors.valuesList('name_first', 'name_last');

juniors.req().then(result => {
    console.log(result) 
    /*
      result = [
        { name_first: 'Kermit', name_last: 'Frog, the' },
        { name_first: 'Fozzie', name_last: 'Bear' },
        { name_first: 'Miss',   name_last: 'Piggy' },
        { name_first: 'Animal', name_last: null }
        ...
      ]
    */
});
```


Order results with orderBy:

```javascript
// find all Apple B's and order by last name
let appleB = People.orm.filter({name_first: 'Apple B'}).orderBy('name_last');

appleB.req().then(result => {
    console.log(result) // prints a list of objects ordered by last name
});
```


Arrays are converted to 'IN' queries:

```javascript
// SQL equivalent: WHERE age IN (14, 15, 16, 17) AND graduated = TRUE
let grads = Students.orm.filter({age: [14, 15, 16, 17], graduated: true});

let promise = grads.req().then(result => {
    // all students age 14, 15, 16, and 17 that have graduated
    return sendCongratsEmail(results);
});

promise.then(x => { 
    // do something else async with the promise ....
});
```
Sub queries:

```javascript
// queries can be combined to produce sub queries
let freshmen = Students.orm.filter({age: 14, graduated: false});
// order the freshmen by their last names
let freshmenIds = freshmen.valuesList('id').orderBy('name_last');

// get their report cards (student_id is a foreign key)
let reports = ReportCards.orm.filter({student_id: freshmenIds, semester: 1});
reports.req().then(result => {
    // do something with the results
    emailParents(result);
});
```


Django ORM-style joins (in development)

```javascript

// use '__' for django-style LEFT JOIN
let reports = ReportCards.orm.filter({
    student__age: 14,
    student__graduated: false,
    semester: 1
}); 

// use '.' for INNER JOIN
let reports = ReportCards.orm.filter({
    'student.age': 14,
    'student.graduated': false,
    semester: 1
}); 
```

## Models

Like Django, you can describe your database schema using models and fields

```javascript 
const jypsy = require('jypsy-orm');

// get access to BaseModel
const models = jypsy.models;

// access to all database fields
const fields = jypsy.fields;

// describe Student table (returns constructor function)
const Student = models.BaseModel.extend('Student', {
    id: fields.AutoSerial({primaryKey: true, nullable: false});
    age: fields.BigInt({nullable: false}),
    graduated: fields.Boolean({nullable: false}),
    name_first: fields.Varchar({maxSize: 20, nullable: false}),
    name_last: fields.Text({nullable: false}),
});

// create an instance of student (can omit new)
let student = new Student();

// construct query
Student.orm.filter({graduated: true, age: 16}).req().then(result => {
    // do something with the results
});
``` 

## Relations

To describe relations between models (tables), use a `ForeignKey` field. Like Django, you have the option of specifying a 'reverse' name.

```javascript
const jypsy = require('jypsy-orm');

// get access to BaseModel
const BaseModel = jypsy.models.BaseModel;

// access to all database fields
const fields = jypsy.fields;

// describe author table
const Author = BaseModel.extend('Author', {
    id:         fields.AutoSerial({primaryKey: true, nullable: false}),
    first_name: fields.Text(),
    last_name:  fields.Text()
});


// describe Book table (returns constructor function)
const Book = BaseModel.extend('Book', {
    id: fields.AutoSerial({primaryKey: true, nullable: false}),
    title: fields.Text(),
    published_year: fields.SmallInt(),

    // foreignkey 'books' can be referenced from Author model 
    author: fields.ForeignKey({model: Author, reverse: 'books'}),
});


// query Books from authors by 'books' reverse field
let authors = Author.orm.filter({books__title: 'The Catcher in the Rye'});

// make database query request
authors.req().then(result => {
    /* result: array of objects
      results = [
          { id: '1', first_name: 'J.D.', last_name: 'Salinger' }
      ]
    */
});
```
Or use reverse in valuesList to 'select' the joined fields.

```javascript 
let authors = Author.orm.filter({
    first_name: 'F. Scott',
    last_name: 'Fitzgerald'
});

// select the title of F. Scott Fitzgerald books and order by published year
authors = authors.valuesList('books__title', 'books__published_year');
authors = authors.orderBy('books__published_year');

authors.req().then(result => {
    /* results: array of objects
        results = [
            { title: 'This Side of Paradise', published_year: 1920 },
            { title: 'The Beautiful and Damned', published_year: 1922 },
            { title: 'The Great Gatsby', published_year: 1925 },            
            ...
        ]
    */
});
``` 