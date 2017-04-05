Introduction
-----------

Control flow graph generator is a project that aim to  enhance Compiler explorer UI in a sence that make assembly
code exploration easier by dividing the code into connected basic blocks and displaying them as a graph structure.


## Usage ##

CFG generator is using the ResfulAPI of Compiler explorer to get assembly output in a JSON format.
The library exposes the function "compile" to the client. This function encapsulates the request send to CE and the
decomposition of the response into connected basic blocks.

the function **compile** take the source code, the compilerId, an obj(explained later) and the id of the block in which
it displays the control flow graphas as inputs and perform decompistion on the assembly code.

```JS
    var codesource = "int main() { return 0;}";
    var compId = "g63";
    var obj = { ... };// content and role explained later in Design.
    var div_id = "some_id";

    compile(codesource, compId, obj, div_id);
```
Note: right now, the decompostion and the display are handled inside compile; maybe later the display part will be handled
outside.

you can see a complete example in **example** folder.


## Contribution

### Steps of the decompostion

first a Post request is performed to CE in order to retreave the assembly ouput of the code source.
when the response is received, the following steps are performed using the json object:

1) separate code(assembly instructions) from Data.
2) seprate functions(identify begin and end of each function).
3) for each function :
   a) decompose into basic blocks.
   b) decompose each basic block  into canonical basic blocks.
   c) make nodes from canonical basic blocks.
   d) make edges from canonical basic blocks.
  Note: remember, the ouput here is  an array of nodes and edges for each function not a single set of nodes and edges.
4) select one of the sets of nodes and edges to display.


the decompostion of the JSON array .asm(from CE response) is virtual(it's real only for the first step), and by virtual I mean
that given an array x(containing asm instruction) we define for each region(function, basic block, canonical basic block) a range(first, last).
this range is just indeces into the array pointing to it's start and end. basically, you find almost for every function's interface
a parmater for the whole code and an array of ranges that specify the actual region.


**Note :** ranges are defined in a C++ish way, meaning that the "last" is not pointing to the last element in the region but
           just the following one.


### boundaries definition
functions:

basic blocks:

canonical basic blocks:





### Design  ###

even though the example in **example folder** work only for gcc and x86 architecture specifically, CFG generator APIs are
designed to be scalable/customizable to different compilers and architectures. This is achieved through defering all regions
identifiers to the client. So, the APIs has arguments that accepts predicates(other functions that define if we reached
current element's end.(current element = function, basic block, canonical basic blocks)). and those predicates are passed
to "compile" through obj paramater.

each Obj field is a function that determine if a particular condition is meat or not. for example let say that we are using
split_to_basic_blocks function. it accepts as a third parameter a function that identify  the end of a basic block. and this
function need to leave in one of Obj fields.

split_to_basic_blocks(asmArr, range(denote the begin and the end of **one** function), Obj.is_end_of_basic_block).






