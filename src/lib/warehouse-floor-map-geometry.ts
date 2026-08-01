type RackRectangle = {
  widthBasisPoints: number;
  heightBasisPoints: number;
};

export const MIN_RACK_LONG_SIDE_BASIS_POINTS = 300;
export const MIN_RACK_AREA_BASIS_POINTS = 30_000;

export const isCompleteRackRectangle = ({ widthBasisPoints, heightBasisPoints }: RackRectangle) =>
  Math.max(widthBasisPoints, heightBasisPoints) >= MIN_RACK_LONG_SIDE_BASIS_POINTS &&
  widthBasisPoints * heightBasisPoints >= MIN_RACK_AREA_BASIS_POINTS;
