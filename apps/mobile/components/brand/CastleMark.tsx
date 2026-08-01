import Svg, { Path } from 'react-native-svg';

import { BRAND_BLUE } from '../../theme';

export default function CastleMark({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Path
        fill={BRAND_BLUE}
        fillRule="evenodd"
        d="M224 790V334h52v-78h54v48h60v-48h54v78h44V218h48v116h46v-78h54v48h60v-48h54v78h50v456H224ZM452 790V672c0-44 27-76 60-76s60 32 60 76v118H452Z"
      />
      <Path fill={BRAND_BLUE} d="M500 116h24v146h-24zM524 126c74-28 140-10 206 36-68 43-132 55-206 25v-61Z" />
    </Svg>
  );
}
