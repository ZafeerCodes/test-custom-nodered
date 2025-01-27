module.exports = function(RED) {
    function InputNode(config) {
      RED.nodes.createNode(this, config);
  
      var context = this.context();
      var node = this;

      var uniqueId = () => {
        return Math.random().toString(36).substr(2, 9);
      }
  
      this.on('input', function(msg) {
        const text = config.text || "";
        node.send({
          node: node.id || "__id",
          nodeText: text,
          arrstr: ["one", "two", "three"],
          arrnum: [2, 22, 222],
          arrobj: [
            {
              id: 1,
              name: "hello",
              age: 123,
              isDropped: true 
            },
            {
              id: 2,
              name: "hi",
              age: 222,
              isDropped: false 
            }
          ],
          objects: {
            noderedId: 2,
            nodeLabel: "yes",
            isGood: false,
          },
          isgood: true,
          name: uniqueId(),
          price: 2222,
          isOpen: true,
          isProcessed: true,
          // ...msg
        });
  
      });
    }
    RED.nodes.registerType("input(test)", InputNode);
  };
  