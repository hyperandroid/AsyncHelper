# AsyncHelper

AsyncHelper is a general purpose library to handle asynchronous processing in nodejs.
The system works with Future objects as the base for message passing and synchronization.

The goal is to expose a clean interface, not only for code readability, but to keep under control all the
 asynchronous operations that could eventually span in the lifecycle of a node js application. The library
 relies on the concept of a `Condition` for signaling asynchronous code activity and a `Future` returned 
 to the developer, so she can be notified about computation results. 
 
The `Condition` allows to choreograph complex operations and have a fast short-circuit mechanism to allow your
code to progress whenever the conditions are met or not. A `Condition` is hence a super-powered boolean events broadcaster. 

Conditions are defined to fail-fast because it met its criteria, or because of built-in timeout control. 
 
## Dispatching asynchronous code
 
The main object to interact with is a `Dispatcher` object.

Since sometimes is important to handle different scarce resources at a time, as much as needed `Dispatcher` objects 
can be created. It makes sense to interact with different pieces of software separately like dealing with your database
or an exposed REST API.
 
The creation of a `Dispatcher`, relies on objects instead of calling `AsyncHelper.waterfall( [], callback )` for well
reasons:
 
* concurrency purposes. A dispatcher can set a maximum number of concurrent operations, so that you can keep
 under fine control the scarce resources of your application, like for example, database connections.
* keep track of running operations, and pending running operations.

A dispatcher is hence a `Queue`, served as a first-in first-out, with interesting control flow capabilities.
How you get notified about dispatched tasks status is by means of `Future objects`.
  
### Future objects  
  
For each element submitted for execution to a `Dispatcher`, a `Future` object will be returned in exchange.
A `Future` object offers a more formal and complete notification scheme than a callback:
 
* a future can be checked for its value. Either not set (still pending execution), and if set, whether is an Error.
* multiple observers can be listening to the future's value change.
* it is latched by a `Condition`, so its value can only be set once. And the future's observers will only be notified once.

```typescript
    const future = _dispatcher.waterfall( [...] );
```

Future objects expose three different callback notification mechanisms (in fact they are the same, but with some sugar icing):

#### onValueSet

```typescript
    
    future.onValueset( (f:Future<number>) => {
        // check future's value.
        // it will be either a number or Error. 
    });
```

#### then

Promisify a future object:

```typescript
    
    future.then(
        (v:number) => {
            // waterfall returned v
        },
        (e:Error) => {
            // waterfall errored
        }
    );
```

#### node

notify on a nodejs standard callback:

```typescript

    future.node(
        (err:Error, v:number) => {
            // waterfall returned v or Error
        }
    );
```

But what can be actually be submitted to a `Dispatcher`.
There are three operations a Dispatcher can execute: 
* `waterfall` of nodejs-style functions. 
* `ParallelCondition` objects.
* arbitrary functions with time control.

### submitNodeSequence/waterfall

`waterfall`-ing is the most common scenario for the AsyncHelper.
It allows to have fine timing control for the whole function waterfall, and pass-through error control. A thrown Error in
any of the functions can be catch and propagated to the `Future` as an error value.

**Bonus points**: if an Error is thrown, you can get a detailed string representation of the waterfall status at the
moment of throw, and all parameters passed to each waterfall function by accessing `sequenceStackTrace` on the error
object.

```typescript

    const _d = new Dispatcher(4);   // 4 concurrent elements. 
                                    // so up to 4 submitted elements will be executing concurrently. 
                                    // all others will be queued until another element ends execution. 

    _d.waterfall(
        [
            function f1() {
                ...
            },
            function f2( err:Error, ret_from_prev_function : any ) {
            }
        ],
        2000,   // 2 seconds to execute the waterfall
        true    // if a function of the waterfall throws an error, halt execution  
    )
    .onValueSet( (f:Future) {
        // the future has value set.
    });

```

#### waterfall function gotchas

* Functions must comply with nodejs's callback convention: (e:Error, args:any).
* Functions return value will be propagated to the next function. The latest waterfall function return value 
will be propagated as the `Future` object's value.
* Functions **can't be fat arrow** functions. Internally, the `Dispatcher` sets **this** as the waterfall
control function itself, otherwise, it won't be able to propagate returned values from function to function.
* Functions **must return a value**. If no the function has no return value it is expected that the next waterfall 
function will be invoked as a callback from something invoked in the current waterfall's function.
* You can set properties on **this**. The execution context will be a per-waterfall submission function which
handles the control flow.

With all this, a real life use case for the waterfall could be:

```typescript
    game_dispatcher.waterfall(
        [
            function() {
            
                // set the next waterfall function as postgres' connect callback. 
                pg.connect( DU.PG_CONN_STRING, this );
            },
            function (err:Error, client:pg.Client, done:()=>void) {
                if (DU.HandleError(err, client, done)) {
                    // stop waterfall, and propagate error to the Future value.
                    throw err;
                }

                // pass postgres specific objects to next waterfall functions 
                this.props = {
                    client : client,
                    done   : done
                };

                this.props.client.query(
                    "update client_created_games " +
                    "set" +
                    " context= $1," +
                    " status= $2," +
                    " ...",
                    [
                        ...
                    ],
                    this)
            },
            function( err:Error /*, result:pg.ResultBuilder*/) {

                if (DU.HandleError(err, this.props.client, this.props.done)) {
                    throw err;
                }

                this.props.client.query(
                    "select  " +
                    " id," +
                    " client_id, ...",
                    [
                        ...
                    ],
                    this
                );
            },
            function(err:Error, result:pg.ResultBuilder) {

                if (DU.HandleError(err, this.props.client, this.props.done)) {
                    throw err;
                }

                // return postgres connection to the pool
                this.props.done();

                if ( result.rows.length===1 ) {
                
                    // future's value
                    return 12345;
                } else {
                
                    // future's value
                    throw new Error("An error.");
                }
            }
        ],
        1000,   // take a second as much to execute waterfall functions. 0 for no timeout. optional
        true    // error pass-through enabled ?
    ).onValueSet(
    
        // check future.getValue() for an error.
        (future:Future) => ...
    );
```

### submitCondition (ParallelCondition)

A `ParallelCondition` can be scheduled for execution. The future's value will be a boolean, indicating `Condition` met
or not.
Remember, the `Condition` might have short-circuited early, and does not mean all `Condition` operations are done, only
the `Condition` value has been set.

```typescript

    const pc = new ParallelCondition( ... );
    
    _dispatcher.submitCondition( pc ).then(
        (condition_result:boolean) => {
            // the condition result was successful or not 
        },
        (err:Error) => {
            // an error ocurred
        }
    );

```

### submit

This `Dispatcher` function submits an arbitrary function for execution. It also exposes timeout control.
Since a dispatcher does not have any knowledge of the execution context, the function has to be bound with its parameters.
 
```typescript

    _dispatcher.submit( 
        function() {
        },
        0   // no timeout
    );
    
    
    function fn( a,b,c ) {
        ...
    }

    // execute fn with a maximum time of 100 milliseconds.
    _dispatcher.submit( fn.bind(null,3,4,5), 100 );
```

## Signaling Dispatcher activity
 
The method `Dispatcher.addIsEmptyListener( (d:Dispatcher)=>void )` will be invoked whenever a dispatcher has drained
all its scheduled tasks.

# Exposed Objects

Though the most interesting object in AsyncHelper is the `Dispatcher`, it exposes some really useful objects as well.

Internally, `Dispatcher` relies on choreographing these objects, but they could also be used directly  

## Condition

Conditions are the basic building blocks. A condition is a simple object 
wrapping a boolean variable, and exposing events based on its changes. 

```typescript

export type SignalObserver = (...args:any[])=>void;

const c = new Condition()
    .onTrue( (c:Condition) => {
        })
    .onFalse( (c:Condition) => {
        })
    .onStateChange( (c:Condition) => {
    });
```

Initially, a `Condition` has no internal state. It is nor true, nor false.
When it has its values set, the `onXXX` callbacks will be invoked.
Internally, a `Condition` uses a `Signal` object, which is useful to register multiple function callbacks
for each event. 

```typescript
c
    .onTrue( (c:Condition) => {...} )
    .onTrue( (c:Condition) => {...} );
    
c.setTrue();    // will notify to both callbacks.
    
```

A value is set by externally calling:

```typescript
    c.setTrue();
    c.setFalse();
```

can also be reseted

```typescript
    c.setNotSet();
```
 
A Condition can also have value set based on a Timer

```typescript

    const _condition : Condition = new Condition()
        .onTrue( (c:Condition) => {
                ...
            })
        .onFalse( (c:Condition) => {
                // invoked in 200ms unless _condition.setTrue() is called before.
            })
        .setTimeout( 200 );
```

## ConditionTree (extends Condition)

A simple boolean variable can be leveraged with a whole tree of `Condition` objects, which 
will be represented by a `ConditionTree`. A tree is defined by one or more `Condition` and 
a boolean operator. 
`ConditionTree` objects short circuit, and notify `onXXX` methods as fast as possible.
The evaluation is totally lazy, and may eventually happen when any of the `Conditions` 
inside the tree fire.
 
```typescript

    const c0 = new Condition();
    const c1 = new Condition();
    const c2 = new Condition();

    const ct : ConditionTree = new ConditionTree( BOOLEAN_OPERATOR.AND )
        .onFalse( (ct : Condition) => {
            })
        .addCondition( c0 )
        .addCondition( c1 )
        .addCondition( c2 );
```

```typescript 

    c0.setTrue();

    // ct still has no value.
    
    c1.setFalse();  // short circuit, ct evaluates to false now, 
                    // regardless c1 and c2 have values set later.

    c1.setTrue();   // it does not change ct's value.
   
    
```

Condition trees can be nested:

```typescript 
    const c0 = new Condition();
    const c1 = new Condition();
    const c2 = new Condition();
    const c3 = new Condition();

    const ct0 : ConditionTree = new ConditionTree( BOOLEAN_OPERATOR.OR )
        .addCondition( c0 )
        .addCondition( c1 );

    const ct1 : ConditionTree = new ConditionTree( BOOLEAN_OPERATOR.OR )
        .addCondition( c2 )
        .addCondition( c3 );

    const ctct : ConditionTree = new ConditionTree( BOOLEAN_OPERATOR.OR )
        .addCondition( ct0 )
        .addCondition( ct1 )
        .onTrue( ( c : Condition ) {
            console.log( c.getCurrentValue() ); // BOOL_OPERATOR.TRUE | BOOL_OPERATOR.FALSE |BOOL_OPERATOR.NOT_SET 
        });

    c2.setTrue();   // ctct invoked onTrue();
    
```

## ParallelCondition (extends ConditionTree)

`ParallelCondition` objects are asynchronous `ConditionTree`s. It is initialized from a collection of
`ParallelCondition` and or callbacks of the form: `(c:Condition, index:number)=>void`.

The idea with this object is each of the elements supplied at construction time will be executed on the next tick.
Elements supplied are either other `ParallelCondition` objects, or worker functions which will notify their
activity result on the `Condition` object supplied as parameter.

The `ParallelCondition` evaluates as an AND `ConditionTree`, so it expects every action to notify back with setTrue().
It will shot-circuit fast, so any action notifying in its parameter `Condition` with `setFalse()` will make the 
`ParallelCondition` evaluate as false, and notify immediately `onFalse()` regardless all parallel operations have
ended.

A real use case for this object is:
* write some activity to the database
    + get postgres connection
    + insert
    + check result
    + notify on the parameter condition
* (and) send some content to redis
* (and) get some XHR content


```typescript
// Wait for **all** these things to happen, with a 3 seconds limit.

function do_postgres_stuff( _condition:Condition, index:number ) {

    // more on the `Dispatcher` beast later 
    
    // Execute the sequence of functions, 
    //   + take a maximum of 2 seconds to execute, otherwise set an error as result
    //   + if an error is thrown in any function, halt sequence execution.
    //
    _dispatcher.submitNodeSequence(
        [
            function getConnection() {
            },
            function insertContent( e:Error, ...) {
            },
            function checkResult( e:Error, ...) {
            }
        ],
        true,   // error fall through
        2000    // max timeout
    ).onValueSet(
    
        ( f : Future ) => {
            const f : any = future.getValue();
            if (f instanceof Error) {
                
                // you can read f.sequenceStacktrace to get detailed info of what went wrong
                console.log( f.sequenceStackTrace );
                
                _condition.setFalse();
            } else {
                _condition.setTrue();
            }
        }
    );    
}

function do_redis_stuff( _condition:Condition, index:number ) {
    ...
}

function do_xhr_stuff( _condition:Condition, index:number ) {
    ...
}

const pc = new ParallelCondition([
        do_posgres_stuff,
        do_redis_stuff,
        do_xhr_stuff
        
    ]).onTrue( (c : Condition) => {
        // all operations ended correctly
    }).onFalse( (c : Condition) => {
        // something went wrong.    
        // condition short-circuited, some operations may not have ended yet.
    }).
    setTimeout( 3000 ); // take 3 secs as much to process the condition, othewise, onFalse will be invoked.

```
