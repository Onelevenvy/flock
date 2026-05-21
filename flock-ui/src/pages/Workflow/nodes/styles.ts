export const handleStyle = `
  .flock-handle-container {
    position: absolute;
  }
  .flock-handle-plus {
    opacity: 0;
    pointer-events: none;
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1000;
    transition: opacity 0.15s ease;
  }
  .flock-handle-container:hover .flock-handle-plus,
  .flock-handle-plus:hover {
    opacity: 1;
    pointer-events: all;
  }
`;
