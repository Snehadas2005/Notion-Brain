import React, { useRef, useEffect } from "react";
import ForceGraph3D from "react-force-graph-3d";
import { playIntroAnimation } from "../animations/gsap.js";

const Universe = ({ data, onNodeClick }) => {
  const fgRef = useRef();

  useEffect(() => {
    if (fgRef.current && data?.nodes?.length > 0) {
        // Delay intro animation to allow 3D scene to initialize
        const timer = setTimeout(() => {
            playIntroAnimation(fgRef);
        }, 500);
        return () => clearTimeout(timer);
    }
  }, [data?.nodes?.length]);

  return (
    <div id="universe-canvas" className="w-full h-full">
      <ForceGraph3D
        ref={fgRef}
        graphData={data}
        backgroundColor="#050814"
        nodeLabel="label"
        nodeColor={node => node.__selected ? "#7c3aed" : (node.semantic ? "#a855f7" : "#6366f1")}
        linkColor={link => link.semantic ? "rgba(168,85,247,0.3)" : "rgba(99,102,241,0.3)"}
        linkDirectionalParticles={link => link.semantic ? 0 : 2}
        linkDirectionalParticleSpeed={0.005}
        onNodeClick={onNodeClick}
        enableNodeDrag={true}
        showNavInfo={false}
      />
    </div>
  );
};

export default Universe;
