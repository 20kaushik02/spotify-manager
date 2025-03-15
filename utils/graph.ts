type GNode = string;
type GEdge = { from: string; to: string };

/**
 * Directed graph, may or may not be connected.
 *
 * NOTE: Assumes that nodes and edges are valid.
 *
 * Example:
 * ```javascript
 * let nodes = ["a", "b", "c", "d", "e"];
 * let edges = [
 *		{ from: "a", to: "b" },
 *		{ from: "b", to: "c" },
 *		{ from: "c", to: "d" },
 *		{ from: "d", to: "a" },
 *		{ from: "e", to: "a" }
 *	];
 * let g = new myGraph(nodes, edges);
 * console.log(g.detectCycle()); // true
 * ```
 */
class myGraph {
  nodes: GNode[];
  edges: GEdge[];
  /**
   * @param nodes Graph nodes IDs
   * @param edges Graph edges b/w nodes
   */
  constructor(nodes: GNode[], edges: GEdge[]) {
    this.nodes = structuredClone(nodes);
    this.edges = structuredClone(edges);
  }

  getDirectHeads(node: GNode): GNode[] {
    return this.edges
      .filter((edge) => edge.to === node)
      .map((edge) => edge.from);
  }

  getDirectHeadEdges(node: GNode): GEdge[] {
    return this.edges.filter((edge) => edge.to === node);
  }

  /** BFS */
  getAllHeads(node: GNode): GNode[] {
    const headSet = new Set<GNode>();
    const toVisit = new Set<GNode>(); // queue
    toVisit.add(node);
    while (toVisit.size > 0) {
      const nextNode = toVisit.values().next().value!;
      const nextHeads = this.getDirectHeads(nextNode);
      nextHeads.forEach((head) => {
        headSet.add(head);
        toVisit.add(head);
      });
      toVisit.delete(nextNode);
    }
    return [...headSet];
  }

  getDirectTails(node: GNode): GNode[] {
    return this.edges
      .filter((edge) => edge.from === node)
      .map((edge) => edge.to);
  }

  /**
   * @param {string} node
   * @returns {{ from: string, to: string }[]}
   */
  getDirectTailEdges(node: GNode): GEdge[] {
    return this.edges.filter((edge) => edge.from === node);
  }

  /** BFS */
  getAllTails(node: GNode): GNode[] {
    const tailSet = new Set<GNode>();
    const toVisit = new Set<GNode>(); // queue
    toVisit.add(node);
    while (toVisit.size > 0) {
      const nextNode = toVisit.values().next().value!;
      const nextTails = this.getDirectTails(nextNode);
      nextTails.forEach((tail) => {
        tailSet.add(tail);
        toVisit.add(tail);
      });
      toVisit.delete(nextNode);
    }
    return [...tailSet];
  }

  /** Kahn's topological sort */
  topoSort(): GNode[] {
    let inDegree: Record<string, number> = {};
    let zeroInDegreeQueue: GNode[] = [];
    let topologicalOrder: GNode[] = [];

    // Initialize inDegree of all nodes to 0
    for (let node of this.nodes) {
      inDegree[node] = 0;
    }

    // Calculate inDegree of each node
    for (let edge of this.edges) {
      inDegree[edge.to]!++;
    }

    // Collect nodes with 0 inDegree
    for (let node of this.nodes) {
      if (inDegree[node] === 0) {
        zeroInDegreeQueue.push(node);
      }
    }

    // process nodes with 0 inDegree
    while (zeroInDegreeQueue.length > 0) {
      let node = zeroInDegreeQueue.shift();
      topologicalOrder.push(node!);

      for (let tail of this.getDirectTails(node!)) {
        inDegree[tail]!--;
        if (inDegree[tail] === 0) {
          zeroInDegreeQueue.push(tail);
        }
      }
    }
    return topologicalOrder;
  }

  /** Check if the graph contains a cycle */
  detectCycle(): boolean {
    // If topological order includes all nodes, no cycle exists
    return this.topoSort().length < this.nodes.length;
  }
}

export { type GNode, type GEdge, myGraph };
export default myGraph;
