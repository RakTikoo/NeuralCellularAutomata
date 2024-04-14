export const renderWGSL = /* wgsl */`
// Your shader code will go here
struct VertexInput {
  @location(0) pos: vec2f,
  @builtin(instance_index) instance: u32,
};
struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(0) cell: vec2f,
  @location(1) state: f32,
};
struct FragInput {
  @location(0) cell: vec2f,
  @location(1) state: f32,
};
// At the top of the code string in the createShaderModule() call
@group(0) @binding(0) var<uniform> grid: vec2f;
@group(0) @binding(1) var<storage> cellState: array<f32>;
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    let i = f32(input.instance); // Save the instance_index as a float
    
    // Compute the cell coordinate from the instance_index
    let cell = vec2f(i % grid.x, floor(i / grid.x));
    let state = f32(cellState[input.instance]);
    let cellOffset = cell / grid * 2; // Compute the offset to cell
    // Add 1 to the position before dividing by the grid size.
    // Subtract 1 after dividing by the grid size.
     
    let gridPos = (input.pos+1) / grid - 1 + cellOffset;
    var output: VertexOutput;
    output.pos = vec4f(gridPos, 0, 1);
    output.cell = cell;
    output.state = state;
    return output;
}

@fragment
fn fragmentMain(input: FragInput) -> @location(0) vec4f {
    //let c = input.cell / grid;
    return vec4f(input.state, 0, 0, 1); // (Red, Green, Blue, Alpha)
}
`