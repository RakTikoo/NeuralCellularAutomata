
import {renderWGSL} from "../shader/render.wgsl.js"
import {computeWGSL} from "../shader/compute.wgsl.js"
import { vertices } from "./constants.js";
import { WORKGROUP_SIZE } from "./constants.js";
import { GRID_SIZE } from "./constants.js";
import { UPDATE_INTERVAL } from "./constants.js";



let mouse_pos = [0.0, 0.0];
async function mouse(event) {
  let x = event.clientX;
  let y = event.clientY;
  mouse_pos = [x/(1024/GRID_SIZE), y/(1024/GRID_SIZE)];
  }

async function main() {
    //==============
    //Some Constants
    //==============
    //=========================================
    //Create canvas and configure to GPU device
    //=========================================
    const canvas = document.querySelector("canvas");
    // Your WebGPU code will begin here!
    if (!navigator.gpu) {
        throw new Error("WebGPU not supported on this browser.");
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error("No appropriate GPUAdapter found.");
    }
    
    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu");
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    // format --> texture to use
    context.configure({
        device: device,
        format: canvasFormat,
    });
    //========================
    //Texture work starts here
    //======================== 
    // Pair of triangles making a square

    const vertexBuffer = device.createBuffer({
      label: "Cell vertices",
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, // buffer to be used for vertex data and want to be able to copy data into it 
    });
    // Create a uniform buffer that describes the grid.
    const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]);
    const uniformBuffer = device.createBuffer({
      label: "Grid Uniforms",
      size: uniformArray.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniformBuffer, 0, uniformArray);
    device.queue.writeBuffer(vertexBuffer, /*bufferOffset=*/0, vertices); // Write the vertex data into the GPU buffer
    const vertexBufferLayout = {
      arrayStride: 8,
      attributes: [{
        format: "float32x2", // GPUVertexFormat type
        offset: 0,
        shaderLocation: 0, // Position, see vertex shader
      }],
    };

    // Storage buffers are general-use buffers that can be read and written to in compute shaders, and read in vertex shaders
    // Create an array representing the active state of each cell.
    const cellStateArray = new Float32Array(GRID_SIZE * GRID_SIZE);
    // Create two storage buffers to hold the cell state.
    const cellStateStorage = [
      device.createBuffer({
        label: "Cell State A",
        size: cellStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      device.createBuffer({
        label: "Cell State B",
         size: cellStateArray.byteLength,
         usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      })
    ];
    
    // Set each cell to a 0 state, then copy the JavaScript array 
    // into the storage buffer.
    for (let i = 0; i < cellStateArray.length; ++i) {
      cellStateArray[i] = 2*Math.random() - 1;
      cellStateArray[i] = 0;
    }
    device.queue.writeBuffer(cellStateStorage[0], 0, cellStateArray);

    const cellShaderModule = device.createShaderModule({
      label: "Cell shader",
      code: renderWGSL,
    });

    // Create a uniform buffer that describes the mouse Pos.
    var mouseArray = new Float32Array([0.0, 0.0, 0.0]);
    const mouseBuffer = device.createBuffer({
      label: "Mouse Uniforms",
      size: mouseArray.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(mouseBuffer, 0, mouseArray);


    // ========================
    // Graphics Shader Stuff
    // ========================

    // Create the compute shader that will process the simulation.
    const simulationShaderModule = device.createShaderModule({
      label: "Game of Life simulation shader",
      code: computeWGSL,
    });
    // Create the bind group layout and pipeline layout.
    const bindGroupLayout = device.createBindGroupLayout({
      label: "Cell Bind Group Layout",
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
        buffer: {} // Grid uniform buffer
      }, {
        binding: 1,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage"} // Cell state input buffer
      }, {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage"} // Cell state output buffer
      }, {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {} // Cell state output buffer
      }]
    });
    // Bind Group - A bind group is a collection of resources that you want to make accessible to your shader at the same time
    // Create a bind group to pass the grid uniforms into the pipeline
    const bindGroups = [
      device.createBindGroup({
        label: "Cell renderer bind group A",
        layout: bindGroupLayout, // Updated Line
        entries: [{
          binding: 0,
          resource: { buffer: uniformBuffer }
        }, {
          binding: 1,
          resource: { buffer: cellStateStorage[0] }
        }, {
          binding: 2, // New Entry
          resource: { buffer: cellStateStorage[1] }
        }, {
          binding: 3, // New Entry
          resource: { buffer: mouseBuffer }
        }],
      }),
      device.createBindGroup({
        label: "Cell renderer bind group B",
        layout: bindGroupLayout, // Updated Line
        entries: [{
          binding: 0,
          resource: { buffer: uniformBuffer }
        }, {
          binding: 1,
          resource: { buffer: cellStateStorage[1] }
        }, {
          binding: 2, // New Entry
          resource: { buffer: cellStateStorage[0] }
        }, {
          binding: 3, // New Entry
          resource: { buffer: mouseBuffer }
        }],
      }),
    ];
    const pipelineLayout = device.createPipelineLayout({
        label: "Cell Pipeline Layout",
        bindGroupLayouts: [ bindGroupLayout ],
    });
    // Create rendering pipeline with the shaders
    const cellPipeline = device.createRenderPipeline({
        label: "Cell pipeline",
        layout: pipelineLayout,
        vertex: {
          module: cellShaderModule,
          entryPoint: "vertexMain",
          buffers: [vertexBufferLayout]
        },
        fragment: {
          module: cellShaderModule,
          entryPoint: "fragmentMain",
          targets: [{
            format: canvasFormat
          }]
        }
    });


    // ========================
    // Compute Shader Stuff
    // ========================

    // Create a compute pipeline that updates the game state.
    const simulationPipeline = device.createComputePipeline({
      label: "Simulation pipeline",
      layout: pipelineLayout,
      compute: {
        module: simulationShaderModule,
        entryPoint: "computeMain",
      }
    });


    // ========================
    // Run Simulation
    // ========================

    // Render rate update
    let step = 0; // Track how many simulation steps have been run
    // Move all of our rendering code into a function
    let curr_pos = mouse_pos;
    let write = 0.0;
    function updateGrid() {
        mouseArray = new Float32Array([mouse_pos[0], mouse_pos[1], write]);
        device.queue.writeBuffer(mouseBuffer, 0, mouseArray);

        // Mouse Handling
        let next_pos = mouse_pos;
        if(curr_pos != next_pos) {
          write = 1.0;  
          //console.log("OK!");
        }
        else {
          write = 0.0;
        }
        curr_pos = next_pos;
        //console.log(mouse_pos);
        




        // Compute Stuff
        const encoder = device.createCommandEncoder();
        const computePass = encoder.beginComputePass();
        // Compute work will go here...
        computePass.setPipeline(simulationPipeline);
        computePass.setBindGroup(0, bindGroups[step % 2]);
        //Dispatch Compute Shader
        const workgroupCount = Math.ceil(GRID_SIZE / WORKGROUP_SIZE);
        computePass.dispatchWorkgroups(workgroupCount, workgroupCount); // Number of workgroups to execute
        
        computePass.end();
        step++; 
        

        // Render Stuff
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: "clear",
            clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
            storeOp: "store",
          }]
        });
        // Draw the grid.
        pass.setPipeline(cellPipeline);
        pass.setBindGroup(0, bindGroups[step % 2]); // Updated!
        pass.setVertexBuffer(0, vertexBuffer);
        pass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE); // 6 vertices, Grid x Grid instances - Dispatch Graphics Shader
        // End the render pass and submit the command buffer
        pass.end();
        device.queue.submit([encoder.finish()]);
        //console.log(mouse_pos);
        
    }
    // Schedule updateGrid() to run repeatedly
    setInterval(updateGrid, UPDATE_INTERVAL);
  }  


window.addEventListener("click", mouse);
main();

