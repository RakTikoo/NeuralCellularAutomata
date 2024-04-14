export const computeWGSL =/* wgsl */`
@group(0) @binding(0) var<uniform> grid: vec2f;
      
@group(0) @binding(1) var<storage> cellStateIn: array<f32>; // Read only
@group(0) @binding(2) var<storage, read_write> cellStateOut: array<f32>;
@group(0) @binding(3) var<uniform> mouse: vec3f;


fn cellIndex(cell: vec2u) -> u32 {
    return (cell.y % u32(grid.y)) * u32(grid.x) + (cell.x % u32(grid.x)); // Wrap around effect
}

fn cellActive(x: u32, y: u32) -> f32 {
  return cellStateIn[cellIndex(vec2(x, y))];
}
// Copied from book of shaders
fn random (st : vec2f) -> f32 {
  return fract(sin(dot(st.xy,
                       vec2(12.9898,78.233)))*
      43758.5453123);
}


fn GoLActivation(in_conv : f32, in_state : f32) -> f32 {
      // Conway's game of life rules:
      switch u32(in_conv) {
        case 2: { // Active cells with 2 neighbors stay active.
          return  in_state;
        }
        case 3: { // Cells with 3 neighbors become or stay active.
          return 1.0;
        }
        default: { // Cells with < 2 or > 3 neighbors become inactive.
          return 0.0;
        }
      }
}

fn ReLu(in_conv : f32, in_state : f32) -> f32 {
  var val = in_conv;
  if(in_conv < 0.0) {
    val = 0.0;
  }

  if(val > 1.0) {
    return 1.0;
  }
  if(val < -1.0) {
    return -1.0;
  }
  return val;

}

fn Absolute(in_conv : f32, in_state : f32) -> f32 {
  var val = abs(in_conv);
  if(val > 1.0) {
    return 1.0;
  }
  if(val < -1.0) {
    return -1.0;
  }
  return val;
}

fn Sigmoid(in_conv : f32, in_state : f32) -> f32 {
  var val = 1/(1 + exp(-in_conv));
  if(val > 1.0) {
    return 1.0;
  }
  if(val < -1.0) {
    return -1.0;
  }
  return val;
}

fn Default(in_conv : f32, in_state : f32) -> f32 {
  return in_conv;
}

fn Gaussian(in_conv : f32, in_state : f32) -> f32 {
  var val =  exp(-(in_conv*in_conv));
  if(val > 1.0) {
    return 1.0;
  }
  if(val < -1.0) {
    return -1.0;
  }
  return val;
}

fn IGaussian(in_conv : f32, in_state : f32) -> f32 {
  var val =  1 - exp(-(in_conv*in_conv));
  if(val > 1.0) {
    return 1.0;
  }
  if(val < -1.0) {
    return -1.0;
  }
  return val;
}

fn ApplyKernel(cell : vec3u) {
  var myArray =  array<vec3f, 3> (
    vec3f(-0.23, -0.75, -1.39),
    vec3f(-1.7, 1.73, -0.09),
    vec3f(-0.51, 1.04, 0.92)
    );
  let top = myArray[0];
  let middle = myArray[1];
  let bottom = myArray[2];

  let in_val : f32 = cellActive(cell.x-1, cell.y+1)*top.x    + cellActive(cell.x, cell.y+1)*top.y    + cellActive(cell.x+1, cell.y+1)*top.z  +
                     cellActive(cell.x-1, cell.y)*middle.x   + cellActive(cell.x, cell.y)*middle.y   + cellActive(cell.x+1, cell.y)*middle.z +
                     cellActive(cell.x-1, cell.y-1)*bottom.x + cellActive(cell.x, cell.y-1)*bottom.y + cellActive(cell.x+1, cell.y-1)*bottom.z;

  let i = cellIndex(cell.xy);

  cellStateOut[i] = ReLu(in_val, cellStateIn[i]);
}


fn ApplyMouse(range : f32) {
  if(mouse.z == 1.0) {
    var tl_y : i32 = i32(grid.y - mouse.y - range);
    var tl_x : i32 = i32(mouse.x - range);
    var br_y : i32 = i32(grid.y - mouse.y + range);
    var br_x : i32 = i32(mouse.x + range);
    for(var x = tl_x; x < br_x; x++) {
      for(var y = tl_y; y < br_y; y++) {
        cellStateOut[cellIndex(vec2(u32(x), u32(y)))] = random(vec2(f32(x), f32(y))); 
        //cellStateOut[cellIndex(vec2(u32(x), u32(y)))] = 1; 
      }
    }
  }
}


@compute
@workgroup_size(8, 8) // Using JS Template literals. Work done in 8x8x1 group
fn computeMain(@builtin(global_invocation_id) cell: vec3u) { // global_invocation_id builtin, which is a three-dimensional vector of unsigned integers that tells you where in the grid of shader invocations you are.
    // Determine how many active neighbors this cell has.
    ApplyMouse(10);

    ApplyKernel(cell);

        
}
`
