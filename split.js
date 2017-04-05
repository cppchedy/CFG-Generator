/*
  @matt
  the code in "compile" function demonstarte how to use the following functions(splitToFunctions, basic_block_splitter,
  ...) to generate a control flow graph for gcc(and for x86).
  all the following function are highly customizable(only seperateCodeFromData is not) for other compiler,
  you can extend the interface of compile function to compile(soucecode, compilerId, indicators),
  indicator = { function_end_indicator: function(...) { ...},
                basic_block_end_indicator: function(...) { ...},
                ...}

         for example: clang uses .LB.. or sth similar to denote jmp location but gcc uses .L*: where * is a number;
         so you can pass other functions that identify ends of each region to handle clang or other compilers special label.
         you can also change the instruction set for example arm uses bl and so for jmp instructions you can came up with
         some predicate to check for this.

         key element are(delemiters of regions): .L*:, jmp .L*, j(e|ge|...) .L*, ret and variants(rep), .LC*:

         I used a C++ish idom(an old one anyway) in defining ranges(first,last) with last not pointing to last instruction
         but the following one.
         asmArr contain the .asm part of the json recupperied from CE. all(arrOfCanonical,basic_block,...) parameters passed
         with asmArr are mostly ranges pointing to asmArr beginning and end of the regions(being functions, basic block,
         cononical basic block...).

         regions definition:
         functions:
                    main():   <---start
                        inst1
                        inst2
                        inst3
                              <---end
          basic_block:
                   foo():
                       inst1  <---start of basic block "bb1"
                       inst2
                       je .L1
                       inst4
                       inst5
                   .L1:      <---end of basic block "bb2" and begin of the new basic block "bb2"
                       inst5
                             <--- end of bb2

         note:the overlap between bb1 end and bb2 start is because of the C++ish way of defining range.

         canonical basic block(if you can find better name change):

                   foo():
                       inst1  <---start of canonical basic block "cbb1"
                       inst2
                       je .L1 //the marker here is the jmp instructions
                       inst4 <--- <-- end of cbb1 and start of cbb2
                       inst5
                   .L1:      <---end of basic block "cbb2" and begin of the new basic block "cbb3"
                       inst5
                             <--- end of cbb3


          the function explose_basic_block take one basic block and partition it according to jmp instruction,
          for example let say we have a basic block like so:

                   inst1
                   inst2
                   je .L1
                   inst
                   inst3
                   inst4
                   je .L2
                   inst5

        we get {[inst1,inst2,je .L1] , [inst,inst3,inst4, je .L2], [inst5]}

        an important note here: in inst5: the following "instruction" is ".L*:" or it's the final instruction
        in the current function, simply because we divide basic block using ".L*:" and as we said we pass one of them
        for explose_basic_block.

        note: further when get to link between nodes with edges, in this particular situation(example above)
        inst5 can be a ret instruction or any other instruction, if it's a ret we don't link with the next block
        otherwise it's done.

*/


//this funciton not portable for other compiler, clang associates data with the function that use id but gcc group all the data
// separetely from the function: (func1:....,func2:....,.LC1:...,)
//for clang you need to do a (std::)stable partition and bring all the functions in front before
//applying "seperateCodeFromData"
function seperateCodeFromData(asmArr) {
    is_label_for_data = function(entry) {
        return ((entry[0] != ".")
                ||  (entry.includes(".LC") == false));
    }

    var code = [];
    var first = 0;
    var last = asmArr.length;
    do {
        code.push(JSON.parse(JSON.stringify(asmArr[first])));
        ++first;
    }while((first != last) &&  is_label_for_data(asmArr[first].text));

    return code;
}

//precondition: asmArr contain the name of the function @pos 1 and
// at least the array contain one instruction .
function splitToFunctions(asmArr, is_end) {
    if(asmArr.length == 0)   return [];
    var result = [];
    var first = 0;
    var last = asmArr.length;
    var fn_range = {start:first, end:null};
    ++first;
    while(first != last) {
        if(is_end(asmArr[first].text)) {
            fn_range["end"] = first;
            result.push(JSON.parse(JSON.stringify(fn_range)));
            fn_range["start"] = first;
        }
        ++first;
    }

    fn_range["end"] = last;
    result.push(fn_range);//possiblitiy of bug because didn't put JSON.parse(JSON.stringify(
    return result;
}

//has_action: detect is there is jmps (not rets because: if a current inst is a ret you have either the next inst is .L*:
//            or you have no more instructions for the current function).
//is_end: stops at .L*: things

//returns an array of ranges of basic blocks.
function basic_block_splitter(asmArr,  range, is_end, has_action) {
    var first = range["start"];
    var last = range["end"];
    if(first == last) return [];
    ++first;

    var range_bb = {name_id:"start" , start:first , end:null, action_pos:[]};
    var result = [];

    var reset_range_with = function(range_bb,  name_id, start) {
            range_bb["name_id"] = name_id;//.L1:
            range_bb["start"] = start;//after .L1
            range_bb["action_pos"] = [];
    }

    while(first != last) {
        var inst = asmArr[first].text;
        if(is_end(inst)) {
            range_bb["end"] = first;
            result.push(JSON.parse(JSON.stringify(range_bb)));
            ++first;//risk of a bug.
            //inst is expected to be .L*: where * in 1,2,...
            reset_range_with(range_bb, inst, first);
        }
        else if(has_action(inst)) {
                range_bb["action_pos"].push(first);
        }
        ++first
    }

    range_bb["end"] = last;
    result.push(JSON.parse(JSON.stringify(range_bb)));
    return result;
}

//asmArr: CE asm arr.
//basic block exp:  {name_id:"start" , start:first , end:null, action_pos:[]}
//return array of ranges: [{name_id:"start" , start:first , end:last},...]
function explose_basic_block(asmArr,  basic_block) {
    var action_pos = basic_block["action_pos"];

    if(action_pos.length == 0)
        return [{
                                          name_id: basic_block.name_id,
                                          start: basic_block.start,
                                          end: basic_block.end
                                      }];
    else if(action_pos.length == 1)
            return [
                {name_id: basic_block.name_id,start: basic_block.start,end:action_pos[0]+1},
                {name_id: basic_block.name_id+"@"+ (action_pos[0]+1),start: action_pos[0]+1,end: basic_block.end}
               ]
    else {
        var first = 0;
        var last = action_pos.length;
        var block_name = basic_block.name_id;
        var tmp = {name_id:block_name, start:basic_block.start, end:action_pos[first]+1 };
        var result = [];
        result.push(JSON.parse(JSON.stringify(tmp)));
        while(first != last-1) {
            tmp["name_id"] = block_name + "@" + (action_pos[first]+1);
            tmp["start"] = action_pos[first]+1;
            ++first;
            tmp["end"] = action_pos[first]+1;
            result.push(JSON.parse(JSON.stringify(tmp)));
        }
        tmp = {name_id:block_name+"@"+(action_pos[first]+1), start:action_pos[first]+1, end:basic_block.end };
        result.push(JSON.parse(JSON.stringify(tmp)));
        return result;

    }

}



function concat_instructions(asmArr, first, last) {
    if(first == last) return "";//if last -1 is changed to last this line is no longuer needed
    console.log("look");
    var result = "";
    while(first != last-1) {//added to delete last \n and handle the last concat outside loop
        console.log(asmArr[first].text);
        result += asmArr[first].text.trim() + "\n";
        ++first;
    }
    //last concat withou \n
    result += asmArr[first].text.trim();
    console.log(asmArr[first].text);

    return result;
}


//asmArr: CE json assembly instruction array.
//arrOfCanonicalBasicBlock: [{name_id:, start:, end:},....]
function make_nodes(asmArr, arrOfCanonicalBasicBlock) {

    var node = {};
    var nodes = [];
    for(let x of arrOfCanonicalBasicBlock) {
        console.log("node name:")
        console.log(x.name_id);
        node["id"] = x.name_id;
        node["label"] = concat_instructions(asmArr,x.start, x.end);
        node["color"] = "#FFAFAF";
        node["shape"] = 'box';
        nodes.push(JSON.parse(JSON.stringify(node)));
    }
    return nodes;
}
//asmArr: CE json assembly instruction array.
//arrOfCanonicalBasicBlock: [{name_id:, start:, end:},....]

//instrruction type requirement: first, check  if it's a jmp, after that check for conditional jmp,
function make_edges(asmArr, arrOfCanonicalBasicBlock, instruction_type, extract_node_name_from_instruction) {

    var jmp_inst = 0;
    var conditional_jmp_inst = 1;
    var not_ret_inst = 2;
    var edge = {};
    var edges = [];

    var set_edge = function(edge, sourceNode, targetNode) {
        edge["from"] = sourceNode;
        edge["to"] = targetNode;
        edge["arrows"] = "to";

    }

    // note: x.end-1 possible value: jmp .L*, {jne,je,jg,...} .L*, ret/rep ret, call and any other instruction that doesn't change control flow

    for(let x of arrOfCanonicalBasicBlock) {
        var last_inst = asmArr[x.end-1].text;
        switch(instruction_type(last_inst)) {
            case jmp_inst:
                {

                //we have to deal only with jmp destination, jmp instruction are always taken.
                    //edge from jump inst
                    console.log("jmp");
                    var target_node = extract_node_name_from_instruction(last_inst);
                    set_edge(edge, x.name_id, target_node);

                    edges.push(JSON.parse(JSON.stringify(edge)));
                    console.log(edge);
                }
                break;
            case conditional_jmp_inst:
                {
                    console.log("condit jmp");
                //deal with : branche taken, branch not taken
                    target_node = extract_node_name_from_instruction(last_inst);
                    set_edge(edge, x.name_id, target_node);
                    edges.push(JSON.parse(JSON.stringify(edge)));
                    console.log(edge);

                    target_node = x.name_id +"@"+ x.end;
                    set_edge(edge, x.name_id, target_node);
                    edges.push(JSON.parse(JSON.stringify(edge)));

                    console.log(edge);
                }
                break;
            case not_ret_inst:
                {
                //precondition: last_inst is not last instruction in asmArr (but it is in canonical basic block)
                //note : asmArr[x.end] expected to be .L*:(name of a basic block)
                //       this .L*: has to be exactly after the last instruction in the current canocial basic block
                    var next_node_name = asmArr[x.end].text;
                    set_edge(edge, x.name_id, next_node_name);
                    edges.push(JSON.parse(JSON.stringify(edge)));
                    console.log("not ret inst");
                    console.log(edge);
                }
                break;
            default:
                    console.log("expect ret instruction or it's variants(rep ret): "+ last_inst);
                break;
        }
    }

    console.log(edges);

    return edges;
}

function show(arr, range) {
    var first = range.start;
    var last = range.end;
    while(first != last) {
        console.log(arr[first].text);
        ++first;
    }
    console.log("---------------------------");
}






