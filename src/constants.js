export const vertices = new Float32Array([
    //   X,    Y,
      -1, -1, // Triangle 1 (Blue)
       1, -1,
       1,  1,
      -1, -1, // Triangle 2 (Red)
       1,  1,
      -1,  1,
    ]);

export const WORKGROUP_SIZE = 8;
export const GRID_SIZE = 256;
export const UPDATE_INTERVAL = 33.33; // Update every 200ms (5 times/sec)
