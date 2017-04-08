
//"auto f = [](auto x) { return x;};\n\ndouble foo(double x)\n{\n  double ui = 14.0 + x;\n  return f(13) + x;\n}\nint def(int y)\n{\n  float xx = 9.7f;\n  ++xx;\n  ++y;\n  int x =0;\n  if((x = y) == -1)\n  {\n    return x;\n  } \n  else return x+y*xx;\n}\n\n"

//"-O3 -std=c++14"

var gccX86 = {
                filterData:  seperateCodeFromData,
                isFunctionEnd:function(x)  { return ((x[0] != ' ') && (x[0] != '.')
                                                            && (x.indexOf(':') != -1)) ;},

                isBasicBlockEnd: function(x) { return x[0] == ".";} ,

                getInstructionType:function(inst) {
                                            inst = inst.trim();
                                            if(inst.includes("jmp")) return 0;
                                            else if(inst[0] == 'j') return 1;
                                            else if(!inst.includes("ret")) return 2;
                                            else return 3;
                                          },

                extractNodeName:function(inst) {
                                     var name = inst.match(/.L\d+/);
                                     return name + ":";
                                  },

                isJmpInstruction: function(x) { var trimed = x.trim(); return ( trimed[0] == 'j');}
             };


function compile(cppSourceCode, compilerId, compilerOpts, displayBlockId, rules) {
    xmlhttp = new XMLHttpRequest();
    var url = "https://gcc.godbolt.org/api/compiler/" +compilerId+"/compile";

    var req = {"source":cppSourceCode,
               "options":compilerOpts,
               "filters":{"labels":true,"directives":true,"commentOnly":true,"intel":true}};

    var tmp = JSON.stringify(req);
    xmlhttp.open('POST', url, true);
    xmlhttp.onreadystatechange = function () {
        if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
            var resp = JSON.parse(xmlhttp.response);

            var code = rules.filterData(resp.asm);
            var funcs = splitToFunctions(code, rules.isFunctionEnd);

            if (funcs.length == 0 ) { console.log("no functions in code"); return ;};

            var functions_nodes = [];
            var functions_edges = [];

            for(let rng of funcs) {
                var  basic_blocks = splitToBasicBlocks(code, rng, rules.isBasicBlockEnd,
                                                                  rules.isJmpInstruction);

                var arrOfCanonicalBasicBlock = [];

                for(let elm of basic_blocks) {
                    var tmp = exploseBasicBlock(code, elm);
                    arrOfCanonicalBasicBlock = arrOfCanonicalBasicBlock.concat(tmp);
                }

                functions_nodes.push(makeNodes(code, arrOfCanonicalBasicBlock));
                functions_edges.push(makeEdges(code, arrOfCanonicalBasicBlock,
                                                rules.getInstructionType,
                                                rules.extractNodeName));
                console.log(functions_edges);
                console.log(functions_nodes);

            }

            var opts = {
              autoResize: true,
              locale: 'en',
              edges: {
                arrows: { to: {enabled: true}},
                smooth: { enabled: false}
              },
              nodes: {
                  font: {'face': 'monospace', 'align': 'left'}
              },
              layout: {
                "hierarchical": {
                  "enabled": true,
                  "sortMethod": "directed",
                  "direction": "UD",
                  nodeSpacing: 300,
                  levelSeparation: 200
                }
              },
              physics:  {
                 hierarchicalRepulsion: {
                   nodeDistance: 300
                 }
                }
            };

            var edges  = new vis.DataSet(functions_edges[1]);
            var nodes_ = new vis.DataSet(functions_nodes[1]);
            var container = document.getElementById(displayBlockId);
            var data = {'nodes': nodes_, 'edges': edges}
            var gph = new vis.Network(container, data, opts);

        }
    }
    xmlhttp.setRequestHeader('Content-Type', 'application/json');
    xmlhttp.setRequestHeader('Accept', 'application/json');
    xmlhttp.send(tmp);
}

