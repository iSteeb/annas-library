import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
// import { ChevronRight } from 'lucide-react';
import { DownloadCloud } from 'lucide-react';

interface Book {
  id: string;
  md5: string;
  title: string;
  author?: string;
  coverUrl?: string;
  year?: string;
  languages?: string;
  format?: string;
  size?: string;
  pages?: number;
  isLocal?: boolean;
}

interface BookCardProps {
  book: Book;
  onClick: (book: Book) => void;
}

export default function BookCard({ book, onClick }: BookCardProps) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current?.complete) setImageLoaded(true);
  }, []);

  const hasCover = book.coverUrl && !imageError;

  return (
    <div
      className="flex flex-col items-center h-full cursor-pointer group"
      onClick={() => onClick(book)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
      aria-label={`${book.title} by ${book.author || 'Unknown'}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(book);
        }
      }}
    >
      {/* Cover */}
      <div className="relative flex justify-center w-full mb-3">
        <div
          className="relative bg-stone-300 transition-all duration-300 aspect-[2/3] w-full max-w-[140px] landscape:max-w-[100px] lg:landscape:max-w-[140px] group-hover:-translate-y-1 shadow-md group-hover:shadow-xl"
          style={{ borderRadius: '0 4px 4px 0' }}
        >
          <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: '0 4px 4px 0' }}>

          {/* Format badge */}
          {book.format && (
            <div className="absolute top-2 right-2 z-30 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white uppercase rounded shadow-md bg-accent">
              {book.format}
            </div>
          )}

          {/* Local badge */}
          {book.isLocal && (
            <div className="absolute top-2 left-2 z-30 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white uppercase rounded shadow-md bg-green-500 flex items-center gap-1" title="Available Locally">
              <DownloadCloud size={10} />
            </div>
          )}

          {/* Fallback */}
          {(!hasCover || !imageLoaded) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-stone-400 to-stone-500">
              <span className="line-clamp-5 text-[10px] font-medium leading-snug text-white/90">
                {book.title}
              </span>
            </div>
          )}

          {hasCover && (
            <img
              ref={imgRef}
              src={book.coverUrl}
              alt={book.title}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              className={`relative z-[1] h-full w-full object-cover transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading="lazy"
              decoding="async"
            />
          )}

          {/* Hover overlay */}
          <div className={`absolute inset-0 z-20 flex items-end justify-center pb-4 transition-all duration-300 ${
            isHovered
              ? 'bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-100'
              : 'bg-black/0 opacity-0'
          }`}>
            <button
              onClick={(e) => { e.stopPropagation(); onClick(book); }}
              className="flex items-center gap-2 px-3 py-2 mx-3 text-sm font-semibold transition-all duration-300 bg-white rounded-lg shadow-lg text-ink hover:bg-accent hover:text-white active:scale-95"
            >
              {t('book.view_details')}
              {/* <ChevronRight size={16} /> */}
            </button>
          </div>
          </div>

          {/* Book Cover Overlay Style */}
          <div
            className="absolute inset-0 z-30 pointer-events-none"
            style={{
              borderRadius: '0 4px 4px 0',
              boxShadow: '2px 2px 4px rgba(0,0,0,0.4)',
              backgroundImage: `url("data:image/svg+xml,%0A%3Csvg width='6' height='150' viewBox='0 0 6 150' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='6' height='150' fill='url(%23paint0_linear)'/%3E%3Cdefs%3E%3ClinearGradient id='paint0_linear' x1='6' y1='61.5234' x2='-9.54301e-06' y2='61.5315' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='white' stop-opacity='0'/%3E%3Cstop offset='0.139111' stop-color='white' stop-opacity='0.2'/%3E%3Cstop offset='0.290477' stop-opacity='0.18'/%3E%3Cstop offset='0.726819' stop-color='%23D8D8D8' stop-opacity='0.273181'/%3E%3Cstop offset='0.839352' stop-opacity='0.15'/%3E%3Cstop offset='1' stop-opacity='0.19'/%3E%3C/linearGradient%3E%3C/defs%3E%3C/svg%3E%0A")`,
              backgroundRepeat: 'repeat-y',
            }}
          />
        </div>
      </div>

      {/* Title and Author */}
      <div className="flex flex-col w-full max-w-[140px] landscape:max-w-[100px] lg:landscape:max-w-[140px] gap-1">
        <h3 className="font-serif text-sm font-bold leading-tight transition-colors md:text-base text-ink line-clamp-2 group-hover:text-accent">
          {book.title}
        </h3>
        <p className="text-xs font-medium md:text-sm text-ink-light line-clamp-1">
          {book.author || t('book.unknown_author')}
        </p>
      </div>
    </div>
  );
}