import { Composition } from 'remotion';
import { Video } from './Video';

const FPS = 30;
const DURATION = 23 * FPS; // 690 frames

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DirectorPromo"
      component={Video}
      durationInFrames={DURATION}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
