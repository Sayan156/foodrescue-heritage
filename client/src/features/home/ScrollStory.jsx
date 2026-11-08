import { useRef, useState } from 'react';
import ImageSequenceCanvas from './ImageSequenceCanvas.jsx';
import HomeActions from './HomeActions.jsx';
import useScrollStory, { useReducedMotion } from './useScrollStory.js';

export default function ScrollStory({ contributionTo }) {
  const sectionRef = useRef(null), stageRef = useRef(null), sequenceRef = useRef(null);
  const reduced = useReducedMotion();
  const [status, setStatus] = useState('loading');
  const animated = !reduced && status !== 'fallback';
  useScrollStory({ sectionRef, stageRef, sequenceRef, animated });
  return <section ref={sectionRef} className="scroll-story" data-animated={animated} aria-labelledby="home-title">
    <div ref={stageRef} className="story-stage">
      <ImageSequenceCanvas ref={sequenceRef} animated={animated} onStatus={setStatus}/>
      <div className="story-opening" data-story-opening>
        <h1 id="home-title">Good food deserves<br/><em>a second purpose.</em></h1>
      </div>
      <div className="story-ending" data-story-ending>
        <h2>A little shared.<br/><em>A lot changed.</em></h2>
        <div data-story-actions><HomeActions contributionTo={contributionTo}/></div>
      </div>
      {!animated && <div className="story-static-actions"><HomeActions contributionTo={contributionTo}/></div>}
    </div>
  </section>;
}
