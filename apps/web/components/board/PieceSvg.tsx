import React from 'react';

export type PieceSymbol =
  | 'wK' | 'wQ' | 'wR' | 'wB' | 'wN' | 'wP'
  | 'bK' | 'bQ' | 'bR' | 'bB' | 'bN' | 'bP';

interface PieceSvgProps {
  piece: PieceSymbol;
  className?: string;
}

export const PieceSvg: React.FC<PieceSvgProps> = ({ piece, className = 'chess-piece' }) => {
  const isWhite = piece.startsWith('w');
  const type = piece.charAt(1);

  const fill = isWhite ? '#ffffff' : '#1e1e1e';
  const stroke = isWhite ? '#1e1e1e' : '#ffffff';
  const strokeWidth = 1.5;

  switch (type) {
    case 'P':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <path
            d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </svg>
      );

    case 'N':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <path
            d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <path
            d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,7.4 17.07,8.07 18,9 C 18.28,9.9 21.08,9.08 22,10 z"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <circle cx="15" cy="14" r="1.5" fill={stroke} />
        </svg>
      );

    case 'B':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.646,38.99 6.677,38.97 6,38 C 7.354,36.54 9,36 9,36 z" />
            <path d="M 12,36 C 12.27,34.01 13.35,33.07 14,31 C 15.65,25.72 17.58,21.67 19.5,17 C 18.12,15.73 17.5,13.83 17.5,12 C 17.5,8.5 20,6 22.5,6 C 25,6 27.5,8.5 27.5,12 C 27.5,13.83 26.88,15.73 25.5,17 C 27.42,21.67 29.35,25.72 31,31 C 31.65,33.07 32.73,34.01 33,36 z" />
            <circle cx="22.5" cy="11.5" r="2" fill={stroke} />
            <path d="M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18" stroke={stroke} />
          </g>
        </svg>
      );

    case 'R':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M 9,39 L 36,39 L 36,36 L 9,36 z" />
            <path d="M 12,36 L 12,32 L 33,32 L 33,36 z" />
            <path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14" />
            <path d="M 34,14 L 31,17 L 14,17 L 11,14" />
            <path d="M 14,17 L 14,29.5 L 31,29.5 L 31,17" />
            <path d="M 14,29.5 L 11,32 L 34,32 L 31,29.5" />
            <path d="M 11,39 L 34,39 L 34,40.5 L 11,40.5 z" />
          </g>
        </svg>
      );

    case 'Q':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.5 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.5 L 14,25 L 6.5,13.5 z" />
            <path d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 L 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 z" />
            <circle cx="6" cy="12" r="1.5" />
            <circle cx="14" cy="9" r="1.5" />
            <circle cx="22.5" cy="8" r="1.5" />
            <circle cx="31" cy="9" r="1.5" />
            <circle cx="39" cy="12" r="1.5" />
          </g>
        </svg>
      );

    case 'K':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M 22.5,11.63 L 22.5,6 M 20,8 L 25,8" stroke={stroke} />
            <path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 24,11.5 21,11.5 20,13 C 19,14 19.5,16 19.5,17 C 19.5,17 17.5,15.5 16.5,16.5 C 15.5,17.5 17,20.5 17,20.5 C 17,20.5 14.5,20 14,21.5 C 13.5,23 15.5,25 15.5,25 z" />
            <path d="M 12.5,37 C 15,40.5 30,40.5 32.5,37 L 32.5,30 C 32.5,30 38.5,25.5 36,19.5 C 33.5,13.5 27,14 27,14 C 27,14 25.5,11.5 22.5,11.5 C 19.5,11.5 18,14 18,14 C 18,14 11.5,13.5 9,19.5 C 6.5,25.5 12.5,30 12.5,30 z" />
            <path d="M 11.5,37 C 17,40.5 28,40.5 33.5,37" />
            <path d="M 12,30 C 17,33.5 28,33.5 33,30" />
          </g>
        </svg>
      );

    default:
      return null;
  }
};

