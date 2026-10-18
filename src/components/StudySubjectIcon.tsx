type Subject='Science'|'History'|'Math'|'English'|'Python'|'Spanish'|'Stats';

export default function StudySubjectIcon({subject}:{subject:Subject}){
 // Native 64px raster sprites avoid fractional SVG scaling and soft filters.
 // eslint-disable-next-line @next/next/no-img-element
 return <img className="pixel-subject-icon" src={`/assets/study-icons/${subject.toLowerCase()}.png`} width={64} height={64} alt="" aria-hidden="true" draggable={false}/>;
}
