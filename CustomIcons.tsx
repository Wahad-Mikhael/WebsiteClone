// Sanitize numeric SVG attributes to prevent React warning floods (NaN/Infinity/negatives).
// When `positive` is true, the value is forced strictly > 0.
const Default_Thickness = 0.75

const safe = (n: any, fallback: number, positive = false): number => {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  if (positive) return Math.max(1, Math.abs(v));
  return v;
};

export function Custom_Window({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="currentColor"
      className={className}
    >
      <g><path d="M0,0h24v24H0V0z" fill="none"/></g>
      <g><path d="M20,2H4C2.9,2,2,2.9,2,4v16c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V4C22,2.9,21.1,2,20,2z M20,11h-7V4h7V11z M11,4v7H4V4H11z M4,13h7v7H4V13z M13,20v-7h7v7H13z"/></g>
    </svg>
  );
}

export function Custom_SlidingDoor({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 -960 960 960" 
      fill="currentColor"
      className={className}
    >
      <path d="M360-440q-17 0-28.5-11.5T320-480q0-17 11.5-28.5T360-520q17 0 28.5 11.5T400-480q0 17-11.5 28.5T360-440Zm240 0q-17 0-28.5-11.5T560-480q0-17 11.5-28.5T600-520q17 0 28.5 11.5T640-480q0 17-11.5 28.5T600-440ZM160-120q-17 0-28.5-11.5T120-160q0-16 14.5-22.5T160-200v-560q0-33 23.5-56.5T240-840h480q33 0 56.5 23.5T800-760v560q17 0 28.5 11.5T840-160q0 17-11.5 28.5T800-120H160Zm80-80h200v-560H240v560Zm280 0h200v-560H520v560Zm-40-320Z"/>
    </svg>
  );
}

export function Custom_Polygon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 448 512"
      fill="currentColor"
      className={className}
    >
      <path d="M384 352c-.35 0-.67.1-1.02.1l-39.2-65.32c5.07-9.17 8.22-19.56 8.22-30.78s-3.14-21.61-8.22-30.78l39.2-65.32c.35.01.67.1 1.02.1 35.35 0 64-28.65 64-64s-28.65-64-64-64c-23.63 0-44.04 12.95-55.12 32H119.12C108.04 44.95 87.63 32 64 32 28.65 32 0 60.65 0 96c0 23.63 12.95 44.04 32 55.12v209.75C12.95 371.96 0 392.37 0 416c0 35.35 28.65 64 64 64 23.63 0 44.04-12.95 55.12-32h209.75c11.09 19.05 31.49 32 55.12 32 35.35 0 64-28.65 64-64 .01-35.35-28.64-64-63.99-64zm-288 8.88V151.12A63.825 63.825 0 0 0 119.12 128h208.36l-38.46 64.1c-.35-.01-.67-.1-1.02-.1-35.35 0-64 28.65-64 64s28.65 64 64 64c.35 0 .67-.1 1.02-.1l38.46 64.1H119.12A63.748 63.748 0 0 0 96 360.88zM272 256c0-8.82 7.18-16 16-16s16 7.18 16 16-7.18 16-16 16-16-7.18-16-16zM400 96c0 8.82-7.18 16-16 16s-16-7.18-16-16 7.18-16 16-16 16 7.18 16 16zM64 80c8.82 0 16 7.18 16 16s-7.18 16-16 16-16-7.18-16-16 7.18-16 16-16zM48 416c0-8.82 7.18-16 16-16s16 7.18 16 16-7.18 16-16 16-16-7.18-16-16zm336 16c-8.82 0-16-7.18-16-16s7.18-16 16-16 16 7.18 16 16-7.18 16-16 16z"/>
    </svg>
  );
}

export function Custom_Rotate({ className, size = 24 }: { className?: string; size?: number | string; }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 3C7.02944 3 3 7.02944 3 12C3 15.0777 4.55928 17.865 7.0231 19.5009L5.25 19.5C4.83579 19.5 4.5 19.8358 4.5 20.25C4.5 20.6297 4.78215 20.9435 5.14823 20.9932L5.25 21H9.25C9.6297 21 9.94349 20.7178 9.99315 20.3518L10 20.25V16.25C10 15.8358 9.66421 15.5 9.25 15.5C8.8703 15.5 8.55651 15.7822 8.50685 16.1482L8.5 16.25L8.49903 18.635C6.07593 17.3557 4.5 14.8247 4.5 12C4.5 7.85786 7.85786 4.5 12 4.5C16.1421 4.5 19.5 7.85786 19.5 12C19.5 12.4142 19.8358 12.75 20.25 12.75C20.6642 12.75 21 12.4142 21 12C21 7.02944 16.9706 3 12 3ZM12 9.25C10.4812 9.25 9.25 10.4812 9.25 12C9.25 13.5188 10.4812 14.75 12 14.75C13.5188 14.75 14.75 13.5188 14.75 12C14.75 10.4812 13.5188 9.25 12 9.25ZM12 10.75C12.6904 10.75 13.25 11.3096 13.25 12C13.25 12.6904 12.6904 13.25 12 13.25C11.3096 13.25 10.75 12.6904 10.75 12C10.75 11.3096 11.3096 10.75 12 10.75Z"/>
    </svg>
  );
}



//____________________BATHROOM FURNITURE__________________________________
export const Custom_Toilet = ({
  x,
  y,
  width,
  height,
  anchorX,
  anchorY,
  length,
  stroke = "#000000",
  strokeWidth = Default_Thickness-0.3, // Bumped this up so it's actually visible! (2 pixels thick)
  fill = "none",
  className,
  ...props
}: any) => {
  const VB_W = 14.885346, VB_H = 24;
  const useAnchor = anchorX != null && anchorY != null && (length != null || width != null);
  const rW = useAnchor ? (width != null ? width : (length as number) * (VB_W / VB_H)) : width;
  const rH = useAnchor ? (length != null ? length : (width as number) * (VB_H / VB_W)) : height;
  const rX = useAnchor ? anchorX - rW / 2 : x;
  const rY = useAnchor ? anchorY : y;

  return (
    <svg
      x={rX}       // Now using your calculated X
      y={rY}       // Now using your calculated Y
      width={rW}   // Now using your calculated Width
      height={rH}  // Now using your calculated Height
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      {...props}
    >
      <g transform="translate(-9.0242772)">
        <g transform="matrix(1.1053327,0,0,1.1053327,-1.8086599,-1.1278282)">
          
          {/* 1. Tank */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="12.913527"
            height="6.1774673"
            x="10.084538"
            y="1.2703518"
            ry="3.0037074"
          />
          
          {/* 2. Tank Button */}
          <circle
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            cx="16.548223"
            cy="4.3740735"
            r="1.0372041"
          />
          
          {/* 3. Seat */}
          <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 12.022663,7.2547544 -0.291754,0.3735334 -0.356877,0.5501859 -0.401487,0.795539 -0.275093,0.7137547 -0.245353,0.7434946 -0.185874,0.684015 -0.141263,0.743494 -0.07435,0.750929 v 0.758365 l 0.0223,0.736059 0.05204,0.780669 0.08178,0.639406 0.09665,0.60223 0.223049,0.780669 0.126393,0.438662 0.185874,0.498141 0.401487,0.840149 0.386617,0.684015 0.587361,0.869888 0.527881,0.565056 0.743494,0.63197 0.602231,0.401487 0.959108,0.453532 0.698884,0.185873 0.67658,0.0074 h 0.650998 l 0.353553,-0.03815 0.298311,-0.06629 0.298311,-0.09391 0.353553,-0.132582 0.425369,-0.198874 0.408796,-0.204398 0.430893,-0.292787 0.342505,-0.276213 0.342505,-0.331457 0.270689,-0.281737 0.397748,-0.452991 0.325932,-0.430893 0.193349,-0.348029 0.220971,-0.381175 0.276214,-0.508233 0.165728,-0.342505 0.09391,-0.248592 0.110485,-0.281738 0.127058,-0.320407 0.08286,-0.276214 0.09391,-0.364602 0.08839,-0.397747 0.05524,-0.281738 0.07182,-0.425369 0.07182,-0.49166 0.03315,-0.303835 0.01105,-0.138107 v -1.762243 l -0.01657,-0.342505 -0.0221,-0.364602 -0.04419,-0.276213 -0.07182,-0.441942 L 22.75229,10.921485 22.630756,10.385631 22.481601,9.9105435 22.238533,9.3304949 22.061756,8.8996018 21.907077,8.5294755 21.735824,8.1814464 21.470659,7.8057959 21.266261,7.5295824 21.048291,7.2590936 20.643409,7.3780932 20.33255,7.429163 19.813378,7.4478191 h -0.679486 -0.508233 -0.591097 -0.624242 -0.325932 -0.370127 -0.270689 -0.64634 -0.795495 -0.861786 -0.552427 l -0.764581,-0.011449 -0.461039,-0.076251 -0.19993,-0.056735 z"
          />
          
          {/* 4. Bowl */}
          <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 19.619367,8.8178439 h -6.185873 l -0.213139,0.024934 -0.189263,0.063087 -0.199778,0.105146 -0.141947,0.099889 -0.199777,0.1524617 -0.168234,0.1629763 -0.09989,0.1261752 -0.105146,0.1945201 -0.0736,0.2155492 -0.07886,0.2418356 -0.105146,0.278637 -0.157719,0.504701 -0.06834,0.27338 -0.06309,0.436355 -0.05783,0.383783 -0.04732,0.436356 -0.02629,0.257608 -0.02103,0.268122 v 1.335354 l 0.02103,0.378526 0.05257,0.341724 0.09463,0.552017 0.08937,0.394297 0.120918,0.509958 0.131433,0.420584 0.199777,0.520473 0.299666,0.573045 0.247093,0.478415 0.268123,0.467899 0.373268,0.425842 0.283894,0.331209 0.320695,0.33121 0.494186,0.352239 0.394298,0.226064 0.373268,0.199778 0.646648,0.19452 0.436356,0.05257 0.478414,0.01051 0.667677,-0.07886 0.509958,-0.157719 0.415327,-0.178748 0.415327,-0.257608 0.425841,-0.362754 0.499443,-0.509958 0.283895,-0.336467 0.294408,-0.394297 0.241836,-0.373269 0.215549,-0.436356 0.194521,-0.420583 0.157719,-0.362754 0.131432,-0.378526 0.08412,-0.283894 0.09463,-0.368011 0.05783,-0.310181 0.0736,-0.415326 0.07886,-0.483672 0.05257,-0.38904 0.02629,-0.294409 v -1.366898 l -0.01051,-0.226063 -0.0368,-0.352239 -0.04206,-0.368011 -0.06309,-0.436356 -0.08412,-0.41007 -0.09463,-0.373268 -0.09463,-0.346982 L 21.101047,10.115044 20.985386,9.7996063 20.869725,9.584057 20.759322,9.4315953 20.638404,9.2896482 20.501714,9.163473 20.270393,8.9899821 20.002271,8.8900934 19.786722,8.8217486 Z"
          />
          
          {/* 5. Hole */}
          <circle
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            cx="16.570608"
            cy="12.222656"
            r="1.3634306"
          />
          
        </g>
      </g>
    </svg>
  );
};

export const Custom_Bathtub = ({
  x,
  y,
  width,
  height,
  anchorX,
  anchorY,
  length,
  stroke = "#000000",
  strokeWidth = Default_Thickness-0.5,
  fill = "none",
  className,
  ...props
}: any) => {
  const VB_W = 23.999998, VB_H = 10.616219;
  const useAnchor = anchorX != null && anchorY != null && (length != null || width != null);
  const rW = useAnchor ? (width != null ? width : (length as number) * (VB_W / VB_H)) : width;
  const rH = useAnchor ? (length != null ? length : (width as number) * (VB_H / VB_W)) : height;
  const rX = useAnchor ? anchorX - rW / 2 : x;
  const rY = useAnchor ? anchorY : y;

  return (
    <svg
      x={rX}       // Now using your calculated X
      y={rY}       // Now using your calculated Y
      width={rW}   // Now using your calculated Width
      height={rH}  // Now using your calculated Height
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      {...props}
    >
      <g transform="translate(4.5329496e-8,0.01380423)">
        <g transform="matrix(1.1107367,0,0,1.1107367,-1.0385287,-3.6069323)">
          
          {/* 1. Bathtub Exterior */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="21.30728"
            height="9.2578173"
            x="1.0849909"
            y="3.3849053"
            ry="0.31149435"
          />
          
          {/* 2. Bathtub Interior */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="18.928185"
            height="7.9392638"
            x="2.5349545"
            y="4.0469322"
            ry="3.9696319"
            rx="3.2593203"
          />
          
          {/* 3. Faucet */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="1.9338161"
            height="0.47181845"
            x="19.978756"
            y="7.7508345"
          />
          
          {/* 4. Handle */}
          <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M 21.932608,7.1188775 V 8.8552473"
          />
          
          {/* 5. Drain Hole */}
          <circle
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            cx="18.014145"
            cy="8.046937"
            r="0.45894632"
          />
          
        </g>
      </g>
    </svg>
  );
};


export const Custom_Small_Shower = ({
  x,
  y,
  width,
  height,
  anchorX,
  anchorY,
  length,
  stroke = "#000000",
  strokeWidth = Default_Thickness-0.25, // Bumped this up so it's actually visible! (2 pixels thick)
  fill = "none",
  className,
  ...props
}: any) => {
  const VB_W = 23.22896, VB_H = 23.240765;
  const useAnchor = anchorX != null && anchorY != null && (length != null || width != null);
  const rW = useAnchor ? (width != null ? width : (length as number) * (VB_W / VB_H)) : width;
  const rH = useAnchor ? (length != null ? length : (width as number) * (VB_H / VB_W)) : height;
  const rX = useAnchor ? anchorX - rW / 2 : x;
  const rY = useAnchor ? anchorY : y;

  return (
    <svg
      x={rX}       // Now using your calculated X
      y={rY}       // Now using your calculated Y
      width={rW}   // Now using your calculated Width
      height={rH}  // Now using your calculated Height
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      {...props}
    >
      <g transform="translate(-0.38552021,0.01380405)">
          
        {/* 1.  */}
        <rect
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          width="22.607645"
          height="22.619452"
          x="0.69617707"
          y="0.29685283"
          ry="0.34189457"
        />
        
        {/* 2.  */}
        <rect
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          width="19.694704"
          height="19.694704"
          x="2.0227273"
          y="1.8311858"
          ry="3.3607094"
        />
        
        {/* 3.  */}
        <circle
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          cx="18.565874"
          cy="18.287632"
          r="0.89975566"
        />
        
        {/* 4. Floor */}
        <path
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m 3.3635792,17.914132 2.204156,2.204157"
        />
        
        <path
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m 3.4136736,15.484551 4.6212135,4.621214"
        />
        
        <path
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M 3.4229143,13.003829 10.436496,20.01741"
        />

        <path
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m 4.3438896,11.46887 8.5131184,8.513117"
        />

        <path
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m 6.2330698,10.902116 9.1861382,9.186139"
        />
        <path
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m 8.2875532,10.429821 7.6866018,7.686602"
        />
        
        <path
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M 9.7044383,9.4143861 16.694405,16.404353"
        />
        
        <path
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m 10.767102,7.9975009 7.662987,7.6629881"
        />
        
        <path
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m 11.215783,5.9666323 9.186138,9.1861387"
        />
        
        <path
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m 11.782537,4.0538372 8.513117,8.5131188"
        />
        
        <path
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m 13.435569,3.2509357 6.871893,6.8718933"
        />
        
        <path
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m 15.915118,3.2037062 4.297885,4.297885"
        />
        
        <path
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m 18.300209,3.1800914 2.06629,2.0662909"
        />
        
        <path
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M 2.0227273,12.821196 2.2531521,11.894449 2.4117846,11.485344 2.678955,11.026145 3.004569,10.692182 3.3301828,10.383266 3.7058913,10.132793 4.1734395,9.8990194 4.7077804,9.6986418 5.0333943,9.6235011 5.4091028,9.5734073 h 0.4174538 l 0.559388,-0.0167 L 6.8117475,9.4982633 7.3544375,9.34798 7.8887783,9.0724608 8.3980719,8.6967523 8.740384,8.3794874 9.0743469,7.9870809 9.2496776,7.7282595 9.4667536,7.3609001 9.5919897,7.0937297 9.7005277,6.7180214 9.8090657,6.1836805 9.8424619,5.8664157 V 5.5157544 l 0.00835,-0.45085 0.075142,-0.4007556 0.066788,-0.2504723 0.075141,-0.2755196 0.141933,-0.3423121 0.225426,-0.3924065 0.233774,-0.3339631 0.242123,-0.2838685 0.225425,-0.2337742 0.225425,-0.2170759 0.258821,-0.2003778 0.525992,-0.3031929"
        />
          

      </g>
    </svg>
  );
};

export const Custom_Large_Shower = ({
  x,
  y,
  width,
  height,
  anchorX,
  anchorY,
  length,
  stroke = "#000000",
  strokeWidth = Default_Thickness-0.4, // Bumped this up so it's actually visible! (2 pixels thick)
  fill = "none",
  className,
  ...props
}: any) => {
  const VB_W = 24, VB_H = 15.790491;
  const useAnchor = anchorX != null && anchorY != null && (length != null || width != null);
  const rW = useAnchor ? (width != null ? width : (length as number) * (VB_W / VB_H)) : width;
  const rH = useAnchor ? (length != null ? length : (width as number) * (VB_H / VB_W)) : height;
  const rX = useAnchor ? anchorX - rW / 2 : x;
  const rY = useAnchor ? anchorY : y;

  return (
    <svg
      x={rX}       // Now using your calculated X
      y={rY}       // Now using your calculated Y
      width={rW}   // Now using your calculated Width
      height={rH}  // Now using your calculated Height
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      {...props}
    >
      <g transform="translate(-0.38552088,0.01380383)">
        <g transform="matrix(1.100146,0,0,1.100146,-1.1509947,-3.3517713)">
          
          {/* 1. Bathtub Exterior */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="21.315287"
            height="13.853086"
            x="1.646647"
            y="3.2841132"
            ry="0.218312" 
          />
         
         <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="18.530993"
            height="11.422249"
            x="3.029156"
            y="4.520906"
            ry="2.1894364" 
          />
         
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 3.9409701,13.261067 0.898477,1.556207"
         />
         
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 3.9409701,11.277876 2.0300098,3.51608"
         />
         
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M 3.9409701,9.2053525 7.170944,14.799831"
         />
         
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 3.9588367,7.168562 4.3790526,7.584742"
         />
         
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M 4.2804351,5.6320359 9.5779043,14.807522"
         />
         
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M 5.4953627,5.6856358 10.770819,14.822995"
         />
         
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M 6.6924237,5.7035022 11.934541,14.783116"
         />
         
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 7.835885,5.6499025 5.28439,9.1528315"
         />
         
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M 9.0865458,5.7213688 14.297717,14.747382"
         />
         
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 10.247874,5.7213688 5.24451,9.0837592"
         />
         
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 11.444934,5.6677691 5.289733,9.1620859"
         />
         
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 12.641995,5.6856358 4.915348,8.5136322"
         />
         
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 13.803323,5.7035022 4.467744,7.7383598"
         />
         
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 14.982518,5.7213688 4.055553,7.0244242"
         />
         
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 16.161712,5.6856358 3.622226,6.2738782"
         />
         
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 17.394506,5.7035022 3.141283,5.4408608"
         />
         
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 18.591567,5.7213688 1.953522,3.3835984"
         />
         
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 19.735029,5.7035022 0.808909,1.4010721"
         />
         
         <circle
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            id="path20"
            cx="19.78863"
            cy="14.011462"
            r="0.55386406" 
         />
          
        </g>
      </g>
    </svg>
  );
};

export const Custom_Single_Sink = ({
  x,
  y,
  width,
  height,
  anchorX,
  anchorY,
  length,
  stroke = "#000000",
  strokeWidth = Default_Thickness-0.1, // Bumped this up so it's actually visible! (2 pixels thick)
  fill = "none",
  className,
  ...props
}: any) => {
  const VB_W = 22.633272, VB_H = 18.868071;
  const useAnchor = anchorX != null && anchorY != null && (length != null || width != null);
  const rW = useAnchor ? (width != null ? width : (length as number) * (VB_W / VB_H)) : width;
  const rH = useAnchor ? (length != null ? length : (width as number) * (VB_H / VB_W)) : height;
  const rX = useAnchor ? anchorX - rW / 2 : x;
  const rY = useAnchor ? anchorY : y;

  return (
    <svg
      x={rX}       // Now using your calculated X
      y={rY}       // Now using your calculated Y
      width={rW}   // Now using your calculated Width
      height={rH}  // Now using your calculated Height
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      {...props}
    >
      <g transform="translate(-0.55010384,0.03326009)">
        <g transform="matrix(1.1474864,0,0,1.1474864,-1.7165015,-1.217885)">
          
          {/* 1. Sink Exterior */}
          <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 3.8022519,2.0479086 0.2558392,-0.073356 0.3554687,-0.082031 0.328125,-0.078125 0.7851563,-0.1484375 0.5625,-0.097656 0.34375,-0.058594 0.453125,-0.0625 0.3046875,-0.042969 0.2070312,-0.027344 0.1835938,-0.027344 0.2382812,-0.027344 0.2539063,-0.03125 0.34375,-0.035156 0.3828125,-0.023437 h 6.0546874 l 0.359375,0.023437 0.304688,0.03125 0.382812,0.03125 0.359375,0.039063 0.484375,0.0625 0.421875,0.070312 0.46875,0.078125 0.351563,0.039063 0.59375,0.09375 0.40625,0.070312 0.523437,0.1171875 0.328125,0.109375 1.605855,5.9931308 0.03477,0.190463 0.01953,0.2929687 v 2.0312489 l -0.01172,0.171876 -0.03906,0.238281 -0.07422,0.246094 -0.08203,0.246093 -0.117187,0.289063 -0.140625,0.28125 -0.167969,0.332032 -0.269531,0.441406 -0.207031,0.292969 -0.214844,0.347656 -0.1875,0.257813 -0.152344,0.1875 -0.152344,0.179687 -0.199218,0.214844 -0.324219,0.292968 -0.265625,0.261719 -0.304688,0.269531 -0.300781,0.234375 -0.300781,0.203125 -0.3125,0.207032 -0.320313,0.210938 -0.3125,0.179687 -0.210937,0.121093 -0.253906,0.117188 -0.261719,0.109375 -0.390625,0.140625 -0.460937,0.15625 -0.347657,0.113281 -0.53125,0.136719 -0.511718,0.132812 -0.546875,0.125 -0.15625,0.02344 -0.199219,0.0078 H 10.229967 L 10.058091,17.255802 9.7260599,17.165959 9.2807474,17.06049 8.7494974,16.931584 8.2260599,16.783146 8.0229348,16.693302 7.7573098,16.576115 7.4291848,16.423771 7.0463723,16.251896 6.7612161,16.12299 6.5385598,16.02924 6.3823098,15.939396 6.1362161,15.77924 5.8393411,15.59174 5.5424661,15.380803 5.3080911,15.189396 5.0698098,14.994084 4.7455911,14.681584 4.4448098,14.369084 4.1557473,14.052678 4.0073099,13.880803 3.8471536,13.697209 3.6948099,13.505803 3.5268411,13.31049 3.3002786,12.978459 3.1987161,12.830021 3.0034036,12.509709 2.8080911,12.162053 2.7104349,11.955021 2.5815286,11.638615 2.3862161,11.212834 2.3041849,10.99799 2.2377786,10.830021 2.2065286,10.712834 2.1869974,10.603459 2.1752786,10.412053 V 8.0526775 l 0.00781,-0.1015625 0.019531,-0.1054688 z"
          />
          
          {/* 2. Sink Bowl */}
          <ellipse
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            cx="11.985606"
            cy="10.06049"
            rx="7.4086113"
            ry="5.3795328"
          />
          
          {/* 3. Drain Hole */}
          <circle
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            cx="11.858815"
            cy="8.8328276"
            r="0.79805923"
          />
          
          {/* 4. Faucet */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="1.1363205"
            height="3.0745895"
            x="11.309934"
            y="3.964622"
          />
          
          {/* 5. Faucet Handle */}
          <circle
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            cx="11.874497"
            cy="3.1814115"
            r="0.86178637"
          />
          
        </g>
      </g>
    </svg>
  );
};


export const Custom_Single_Vanity = ({
  x,
  y,
  width,
  height,
  anchorX,
  anchorY,
  length,
  stroke = "#000000",
  strokeWidth = Default_Thickness-0.4, // Bumped this up so it's actually visible! (2 pixels thick)
  fill = "none",
  className,
  ...props
}: any) => {
  const VB_W = 24, VB_H = 19.642498;
  const useAnchor = anchorX != null && anchorY != null && (length != null || width != null);
  const rW = useAnchor ? (width != null ? width : (length as number) * (VB_W / VB_H)) : width;
  const rH = useAnchor ? (length != null ? length : (width as number) * (VB_H / VB_W)) : height;
  const rX = useAnchor ? anchorX - rW / 2 : x;
  const rY = useAnchor ? anchorY : y;

  return (
    <svg
      x={rX}       // Now using your calculated X
      y={rY}       // Now using your calculated Y
      width={rW}   // Now using your calculated Width
      height={rH}  // Now using your calculated Height
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      {...props}
    >
      <g transform="translate(-0.55010366,0.03326019)">
        <g transform="matrix(1.202503,0,0,1.202503,-3.2354571,-2.1057065)">
          
          {/* 1. Vanity Exterior  */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="19.508369"
            height="15.884677"
            x="3.3730676"
            y="1.9484438"
            ry="0.46545684"
          />
          
          {/* 2.  Button */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="2.522269"
            height="1.7378224"
            x="5.0342116"
            y="3.4896247"
            ry="0.12971991"
          />
          
          {/* 3.  Sink Bowl */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="14"
            height="9.6150198"
            x="6.1"
            y="6"
            ry="4.8075099"
          />
          
          {/* 4. Drain Hole */}
          <circle
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            cx="13.079497"
            cy="11.164716"
            r="0.8465271"
          />
          
          {/* 5. Faucet */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="1.1923653"
            height="3.1454902"
            x="12.508609"
            y="5.2763867"
          />

          {/* 6. Faucet Handle */}
          <circle
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            cx="13.096631"
            cy="4.364409"
            r="0.90972179"
          />

          {/* 6. Dashed line */}
          <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={0.8}
            d="M 22.882245,17.041937 H 3.3736027"
          />

        </g>
      </g>
    </svg>
  );
};


export const Custom_Double_Vanity = ({
  x,
  y,
  width,
  height,
  anchorX,
  anchorY,
  length,
  stroke = "#000000",
  strokeWidth = Default_Thickness-0.55, // Bumped this up so it's actually visible! (2 pixels thick)
  fill = "none",
  className,
  ...props
}: any) => {
  const VB_W = 24, VB_H = 8.3640213;
  const useAnchor = anchorX != null && anchorY != null && (length != null || width != null);
  const rW = useAnchor ? (width != null ? width : (length as number) * (VB_W / VB_H)) : width;
  const rH = useAnchor ? (length != null ? length : (width as number) * (VB_H / VB_W)) : height;
  const rX = useAnchor ? anchorX - rW / 2 : x;
  const rY = useAnchor ? anchorY : y;

  return (
    <svg
      x={rX}       // Now using your calculated X
      y={rY}       // Now using your calculated Y
      width={rW}   // Now using your calculated Width
      height={rH}  // Now using your calculated Height
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      {...props}
    >
      <g transform="translate(-0.55010368,0.03326012)">
        <g transform="matrix(1.0683947,0,0,1.0683947,-0.93384131,-4.5355394)">
          
          {/* 1. Vanity Exterior  */}
          <rect
            fill="#fcfcfc"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="22.163609"
            height="7.5285869"
            x="1.5389483"
            y="4.3640599"
            ry="0.18359375" 
         />
         
         {/* 2. Dashed Line  */}
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M 23.702557,11.385939 H 1.5363745"
            strokeDasharray={0.8}
         />
         
         {/* 3. Left Sink Bowl  */}
         <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="7.0257277"
            height="3.5"
            x="3.5773921"
            y="6.1622286"
            ry="2.0349963" 
         />
         
         {/* 4. Right Sink Bowl  */}
         <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="7.0257277"
            height="3.5"
            x="14.579426"
            y="6.1622286"
            ry="2.0349963" 
         />
         
         {/* 5. Right Faucet Handle  */}
         <ellipse
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            cx="17.040501"
            cy="5.2430849"
            rx="0.27813679"
            ry="0.38100177" 
         />
         
         {/* 6. Right Faucet Handle  */}
         <ellipse
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            cx="19.20027"
            cy="5.2430849"
            rx="0.27813679"
            ry="0.38100177"
         />
         
         {/* 1. Vanity Exterior  */}
         <circle
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            cx="11.331353"
            cy="5.7089272"
            r="0.57259041" 
         />
         
         {/* 1. Vanity Exterior  */}
         <circle
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            cx="13.8726"
            cy="5.7089272"
            r="0.57259041" 
         />
         
         {/* 1. Vanity Exterior  */}
         <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="1.5055791"
            height="0.90409929"
            x="11.851669"
            y="8.9129553"
            ry="0.062267303" 
         />
         
         {/* 1. Vanity Exterior  */}
         <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="0.52392918"
            height="1.5947846"
            x="17.852121"
            y="5.657084"
            ry="0" 
         />
         
         {/* 1. Vanity Exterior  */}
         <circle
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            cx="18.11043"
            cy="5.2429738"
            r="0.40780824" 
         />
         
         {/* 1. Vanity Exterior  */}
         <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="0.52392918"
            height="1.5947846"
            x="6.8500891"
            y="5.657084"
            ry="0" 
         />
         
         {/* 1. Vanity Exterior  */}
         <circle
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            cx="7.1083961"
            cy="5.2429738"
            r="0.40780824"
         />
         
         {/* 1. Vanity Exterior  */}
         <ellipse
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            cx="6.0384679"
            cy="5.2430849"
            rx="0.27813679"
            ry="0.38100177" 
         />
         
         {/* 1. Vanity Exterior  */}
         <ellipse
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            cx="8.1982355"
            cy="5.2430849"
            rx="0.27813679"
            ry="0.38100177" 
         />
         
         {/* 1. Vanity Exterior  */}
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M 12.620753,11.892647 V 11.385939"
         />

        </g>
      </g>
    </svg>
  );
};



//____________________BEDROOM FURNITURE__________________________________

export const Custom_King_Bed = ({
  x,
  y,
  width,
  height,
  anchorX,
  anchorY,
  length,
  stroke = "#000000",
  strokeWidth = Default_Thickness-0.4, // Bumped this up so it's actually visible! (2 pixels thick)
  fill = "none",
  className,
  ...props
}: any) => {
  const VB_W = 23.153584, VB_H = 24.000006;
  const useAnchor = anchorX != null && anchorY != null && (length != null || width != null);
  const rW = useAnchor ? (width != null ? width : (length as number) * (VB_W / VB_H)) : width;
  const rH = useAnchor ? (length != null ? length : (width as number) * (VB_H / VB_W)) : height;
  const rX = useAnchor ? anchorX - rW / 2 : x;
  const rY = useAnchor ? anchorY : y;

  return (
    <svg
      x={rX}       // Now using your calculated X
      y={rY}       // Now using your calculated Y
      width={rW}   // Now using your calculated Width
      height={rH}  // Now using your calculated Height
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      {...props}
    >
      <g transform="translate(-1.9692902)">
        <g transform="matrix(1.5290423,0,0,1.5290423,-7.909127,-5.651335)">
          
          {/* Top Pillow/Headboard Area */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="14.461743"
            height="1.3921039"
            x="6.8878651"
            y="3.9459965"
            ry="0.69605196"
          />
          
          {/* Main Mattress Body */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="13.819086"
            height="13.799789"
            x="7.1863189"
            y="5.34231"
            ry="0.86668169"
          />
          
          {/* Blanket/Comforter Fold */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="14.742539"
            height="2.5120015"
            x="6.6605258"
            y="10.916634"
            ry="0.41797829"
          />
          
          {/* Right Pillow */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="4.4378614"
            height="2.8228192"
            x="14.752299"
            y="6.7161412"
            ry="0.76192719"
          />
          
          {/* Left Pillow */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="4.4378614"
            height="2.8228192"
            x="9.039834"
            y="6.7161412"
            ry="0.76192719"
          />
          
        </g>
      </g>
    </svg>
  );
};

export const Custom_Queen_Bed = ({
  x,
  y,
  width,
  height,
  anchorX,
  anchorY,
  length,
  stroke = "#000000",
  strokeWidth = Default_Thickness-0.4, // Bumped this up so it's actually visible! (2 pixels thick)
  fill = "none",
  className,
  ...props
}: any) => {
  const VB_W = 23.153584, VB_H = 24.000006;
  const useAnchor = anchorX != null && anchorY != null && (length != null || width != null);
  const rW = useAnchor ? (width != null ? width : (length as number) * (VB_W / VB_H)) : width;
  const rH = useAnchor ? (length != null ? length : (width as number) * (VB_H / VB_W)) : height;
  const rX = useAnchor ? anchorX - rW / 2 : x;
  const rY = useAnchor ? anchorY : y;

  return (
    <svg
      x={rX}       // Now using your calculated X
      y={rY}       // Now using your calculated Y
      width={rW}   // Now using your calculated Width
      height={rH}  // Now using your calculated Height
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      {...props}
    >
      <g transform="translate(-1.9692902)">
        <g transform="matrix(1.5290423,0,0,1.5290423,-7.909127,-5.651335)">
          
          {/* Top Pillow/Headboard Area */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="14.461743"
            height="1.3921039"
            x="6.8878651"
            y="3.9459965"
            ry="0.69605196"
          />
          
          {/* Main Mattress Body */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="13.819086"
            height="13.799789"
            x="7.1863189"
            y="5.34231"
            ry="0.86668169"
          />
          
          {/* Blanket/Comforter Fold */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="14.742539"
            height="2.5120015"
            x="6.6605258"
            y="10.916634"
            ry="0.41797829"
          />
          
          {/* Right Pillow */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="4.4378614"
            height="2.3"
            x="14.752299"
            y="6.7161412"
            ry="0.76192719"
          />
          
          {/* Left Pillow */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="4.4378614"
            height="2.3"
            x="9.039834"
            y="6.7161412"
            ry="0.76192719"
          />
          
        </g>
      </g>
    </svg>
  );
};

export const Custom_Double_Bed = ({
  x,
  y,
  width,
  height,
  anchorX,
  anchorY,
  length,
  stroke = "#000000",
  strokeWidth = Default_Thickness-0.4, // Bumped this up so it's actually visible! (2 pixels thick)
  fill = "none",
  className,
  ...props
}: any) => {
  const VB_W = 23.153584, VB_H = 24.000006;
  const useAnchor = anchorX != null && anchorY != null && (length != null || width != null);
  const rW = useAnchor ? (width != null ? width : (length as number) * (VB_W / VB_H)) : width;
  const rH = useAnchor ? (length != null ? length : (width as number) * (VB_H / VB_W)) : height;
  const rX = useAnchor ? anchorX - rW / 2 : x;
  const rY = useAnchor ? anchorY : y;

  return (
    <svg
      x={rX}       // Now using your calculated X
      y={rY}       // Now using your calculated Y
      width={rW}   // Now using your calculated Width
      height={rH}  // Now using your calculated Height
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      {...props}
    >
      <g transform="translate(-1.9692902)">
        <g transform="matrix(1.5290423,0,0,1.5290423,-7.909127,-5.651335)">
          
          {/* Top Pillow/Headboard Area */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="14.461743"
            height="1.3921039"
            x="6.8878651"
            y="3.9459965"
            ry="0.69605196"
          />
          
          {/* Main Mattress Body */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="13.819086"
            height="13.799789"
            x="7.1863189"
            y="5.34231"
            ry="0.86668169"
          />
          
          {/* Blanket/Comforter Fold */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="14.742539"
            height="2.5120015"
            x="6.6605258"
            y="10.916634"
            ry="0.41797829"
          />
          
          {/* Right Pillow */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="4.4378614"
            height="2.25"
            x="14.752299"
            y="6.7161412"
            ry="0.76192719"
          />
          
          {/* Left Pillow */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="4.4378614"
            height="2.25"
            x="9.039834"
            y="6.7161412"
            ry="0.76192719"
          />
          
        </g>
      </g>
    </svg>
  );
};


export const Custom_Single_Bed = ({
  x,
  y,
  width,
  height,
  anchorX,
  anchorY,
  length,
  stroke = "#000000",
  strokeWidth = Default_Thickness-0.4, // Bumped this up so it's actually visible! (2 pixels thick)
  fill = "none",
  className,
  ...props
}: any) => {
  const VB_W = 13.917426, VB_H = 23.887512;
  const useAnchor = anchorX != null && anchorY != null && (length != null || width != null);
  const rW = useAnchor ? (width != null ? width : (length as number) * (VB_W / VB_H)) : width;
  const rH = useAnchor ? (length != null ? length : (width as number) * (VB_H / VB_W)) : height;
  const rX = useAnchor ? anchorX - rW / 2 : x;
  const rY = useAnchor ? anchorY : y;

  return (
    <svg
      x={rX}       // Now using your calculated X
      y={rY}       // Now using your calculated Y
      width={rW}   // Now using your calculated Width
      height={rH}  // Now using your calculated Height
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      {...props}
    >
      <g transform="translate(-6.5873688,-0.05624711)">

          
        {/* Top Pillow/Headboard Area */}
        <rect
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          width="13.259964"
          height="2.142513"
          x="6.9160995"
          y="0.30624712"
          ry="1.0712565"
        />
        
        {/* Bed */}
        <rect
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          width="12.670712"
          height="21.23852"
          x="7.2107253"
          y="2.4552388"
          ry="1.3338635"
        />
        
        {/* Blanket */}
        <rect
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          width="13.517426"
          height="3.8660877"
          x="6.7873688"
          y="11.034383"
          ry="0.64328808"
        />
        
        {/* Pillow */}
        <rect
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          width="6.7856779"
          height="3.75"
          x="10.153243"
          y="4.1739888"
          ry="1.1650189"
        />
          

      </g>
    </svg>
  );
};


//____________________LIVING ROOM FURNITURE__________________________________

export const Custom_Single_Couch = ({
  x,
  y,
  width,
  height,
  anchorX,
  anchorY,
  length,
  stroke = "#000000",
  strokeWidth = Default_Thickness-0.20, // Bumped this up so it's actually visible! (2 pixels thick)
  fill = "none",
  className,
  ...props
}: any) => {
  const VB_W = 23.999996, VB_H = 22.597683;
  const useAnchor = anchorX != null && anchorY != null && (length != null || width != null);
  const rW = useAnchor ? (width != null ? width : (length as number) * (VB_W / VB_H)) : width;
  const rH = useAnchor ? (length != null ? length : (width as number) * (VB_H / VB_W)) : height;
  const rX = useAnchor ? anchorX - rW / 2 : x;
  const rY = useAnchor ? anchorY : y;

  return (
    <svg
      x={rX}       // Now using your calculated X
      y={rY}       // Now using your calculated Y
      width={rW}   // Now using your calculated Width
      height={rH}  // Now using your calculated Height
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      {...props}
    >
      <g transform="translate(9.3004559e-8,0.06126168)">
        <g transform="matrix(1.2808941,0,0,1.2808941,-2.6477683,-3.3707437)">
                  
         {/* 1. Couch Seat */}
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M 18.88821,4.7018692 V 18.810745 a 1.2165992,1.2165992 135 0 1 -1.216599,1.216599 l -12.5597114,0 A 1.1841424,1.1841424 45 0 1 3.9277572,18.843202 l 0,-14.330612"
         />
         
         {/* 2. Couch Pillow */}
         <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="11.296555"
            height="4.182374"
            x="5.7942772"
            y="7.468729"
            ry="1.2138975" 
         />
         
         {/* 3. Couch Back */}
         <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="13.203451"
            height="2.2709997"
            x="4.7671247"
            y="5.197876"
            ry="0.63554144" 
         />
         
         {/* 4. Couch Perimeter */}
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 11.34375,2.8046875 h 6.435228 a 2.8265558,2.8265558 45 0 1 2.826556,2.8265558 V 17.915838 a 0.88878265,0.88878265 135 0 1 -0.888783,0.888783 H 19.244263 A 1.0031183,1.0031183 45 0 1 18.241145,17.801503 V 6.0034236 A 0.82373605,0.82373605 45 0 0 17.417409,5.1796875 H 5.5482721 A 0.9741751,0.9741751 135 0 0 4.574097,6.1538626 V 18.052825 A 0.72061175,0.72061175 135 0 1 3.8534853,18.773437 H 3.0204367 A 0.75481168,0.75481168 45 0 1 2.265625,18.018625 V 5.3838731 A 2.6016448,2.6016448 135.09941 0 1 4.876298,2.782244 Z"
          />
          
        </g>
      </g>
    </svg>
  );
};


export const Custom_Double_Couch = ({
  x,
  y,
  width,
  height,
  anchorX,
  anchorY,
  length,
  stroke = "#000000",
  strokeWidth = Default_Thickness-0.30, // Bumped this up so it's actually visible! (2 pixels thick)
  fill = "none",
  className,
  ...props
}: any) => {
  const VB_W = 23.999998, VB_H = 13.317182;
  const useAnchor = anchorX != null && anchorY != null && (length != null || width != null);
  const rW = useAnchor ? (width != null ? width : (length as number) * (VB_W / VB_H)) : width;
  const rH = useAnchor ? (length != null ? length : (width as number) * (VB_H / VB_W)) : height;
  const rX = useAnchor ? anchorX - rW / 2 : x;
  const rY = useAnchor ? anchorY : y;

  return (
    <svg
      x={rX}       // Now using your calculated X
      y={rY}       // Now using your calculated Y
      width={rW}   // Now using your calculated Width
      height={rH}  // Now using your calculated Height
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      {...props}
    >
      <g transform="translate(0,0.01808456)">
        <g transform="matrix(1.1050843,0,0,1.1050843,-0.9697275,-3.2832116)">
                  
         {/* 1. Right Seat */}
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 2.6295534,6.5254053 v 7.4503617 a 0.87970236,0.87970236 45 0 0 0.8797024,0.879702 h 7.4771482 a 0.75267271,0.75267271 135 0 0 0.752673,-0.752673 V 6.5084294"
            transform="matrix(-1,0,0,1,23.494727,-0.0045232)"
         />
         
          {/* 2. Left Seat */}
         <path
            fill="#f8f8f8"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 2.6295534,6.144301 v 7.831466 a 0.87970236,0.87970236 45 0 0 0.8797024,0.879702 h 7.4771482 a 0.75267271,0.75267271 135 0 0 0.752673,-0.752673 V 6.5084294"
         />
         
         {/* 3. Couch Back */}
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 11.645165,3.1046407 h 8.412956 a 2.3871922,2.3871922 45 0 1 2.387192,2.3871922 v 7.0994781 a 0.71337747,0.71337747 135 0 1 -0.713377,0.713377 l -1.68379,0 A 0.92314614,0.92314614 45 0 1 19.125,12.381542 l 0,-5.8776358 c -1.591186,0.5716926 -3.475803,0.9495107 -7.36935,0 -2.3266374,0.636052 -4.7422825,0.8594322 -7.3914753,0 V 12.421878 A 0.84742329,0.84742329 135 0 1 3.5167514,13.269301 H 1.7423553 A 0.7148408,0.7148408 45 0 1 1.0275145,12.55446 V 5.4922125 A 2.3617876,2.3617876 134.91057 0 1 3.3819292,3.1304364 Z"
         />
         
         {/* 4. Diagonal Line */}
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth-0.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M 4.3641747,6.5039062 1.700957,3.8406885"
         />
         
         {/* 5. Diagonal Line */}
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth-0.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M 19.125,6.5039062 21.785135,3.843771"
         />
          
        </g>
      </g>
    </svg>
  );
};

export const Custom_Triple_Couch = ({
  x,
  y,
  width,
  height,
  anchorX,
  anchorY,
  length,
  stroke = "#000000",
  strokeWidth = Default_Thickness-0.35, // Bumped this up so it's actually visible! (2 pixels thick)
  fill = "none",
  className,
  ...props
}: any) => {
  const VB_W = 23.999998, VB_H = 11.81083;
  const useAnchor = anchorX != null && anchorY != null && (length != null || width != null);
  const rW = useAnchor ? (width != null ? width : (length as number) * (VB_W / VB_H)) : width;
  const rH = useAnchor ? (length != null ? length : (width as number) * (VB_H / VB_W)) : height;
  const rX = useAnchor ? anchorX - rW / 2 : x;
  const rY = useAnchor ? anchorY : y;

  return (
    <svg
      x={rX}       // Now using your calculated X
      y={rY}       // Now using your calculated Y
      width={rW}   // Now using your calculated Width
      height={rH}  // Now using your calculated Height
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      {...props}
    >
      <g transform="translate(0,0.01808444)">
        <g transform="matrix(1.0943505,0,0,1.0943505,-1.0413429,-4.5535275)">
                  
         {/* 1. Right Seat */}
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 2.3731447,6.895978 v 7.146129 a 0.7448562,0.7448562 45 0 0 0.7448562,0.744856 H 8.0820451 A 0.68497412,0.68497412 135 0 0 8.7670192,14.101989 V 6.9428529"
            transform="matrix(-1,0,0,1,23.813064,0)" 
         />
         
         {/* 2. Middle Seat */}
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 8.7670192,6.9428529 v 7.1765041 a 0.65655833,0.65655833 45 0 0 0.6565583,0.656558 h 4.9616615 a 0.67392612,0.67392612 135 0 0 0.673926,-0.673926 V 6.9428529"
         />
         
         {/* 3. Left Seat */}
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 2.3731447,6.895978 v 7.146129 a 0.7448562,0.7448562 45 0 0 0.7448562,0.744856 H 8.0820451 A 0.68497412,0.68497412 135 0 0 8.7670192,14.101989 V 6.9428529"
         />
         
         {/* 4. Couch Back */}
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m 13.935672,4.2944154 h 6.81155 a 1.9851563,1.9851563 45 0 1 1.985156,1.9851563 v 6.5814503 a 0.6599565,0.6599565 135 0 1 -0.659957,0.659956 l -1.262264,0 A 0.69296876,0.69296876 45 0 1 20.117188,12.828009 V 6.9428529 H 3.7178349 l 0,5.8555601 a 0.70693974,0.70693974 135 0 1 -0.7069397,0.70694 H 1.7353941 A 0.63383163,0.63383163 45 0 1 1.1015625,12.871521 V 6.2144624 a 1.920047,1.920047 135 0 1 1.920047,-1.920047 h 7.0739685 z"
         />
         
         {/* 5. Diagonal Line */}
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth-0.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M 3.7178349,6.9428529 1.647944,4.8729619"
         />
         
         {/* 6. Diagonal Line */}
         <path
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth-0.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M 20.117188,6.9428529 22.167464,4.8925764"
         />
         
         {/* 7. Left Pillow */}
         <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth-0.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="5.0371103"
            height="1.8915541"
            x="3.7220564"
            y="7.2373714"
            ry="0.94577706" 
         />
         
         {/* 8. Right Pillow */}
         <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth-0.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="4.9726396"
            height="1.8933747"
            x="15.079167"
            y="7.2364612"
            ry="0.94668734" 
         />
         
         {/* 9. Middle Pillow */}
         <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth-0.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="6.1888256"
            height="1.8610756"
            x="8.8163843"
            y="7.2622995"
            ry="0.93053782" 
         />
          
        </g>
      </g>
    </svg>
  );
};



//____________________KITCHEN FURNITURE__________________________________

export const Custom_Stove = ({
  x,
  y,
  width,
  height,
  anchorX,
  anchorY,
  length,
  stroke = "#000000",
  strokeWidth = Default_Thickness-0.25, // Bumped this up so it's actually visible! (2 pixels thick)
  fill = "none",
  className,
  ...props
}: any) => {
  const VB_W = 24, VB_H = 22.461872;
  const useAnchor = anchorX != null && anchorY != null && (length != null || width != null);
  const rW = useAnchor ? (width != null ? width : (length as number) * (VB_W / VB_H)) : width;
  const rH = useAnchor ? (length != null ? length : (width as number) * (VB_H / VB_W)) : height;
  const rX = useAnchor ? anchorX - rW / 2 : x;
  const rY = useAnchor ? anchorY : y;

  return (
    <svg
      x={rX}       // Now using your calculated X
      y={rY}       // Now using your calculated Y
      width={rW}   // Now using your calculated Width
      height={rH}  // Now using your calculated Height
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      {...props}
    >

                  
      {/* 1. Stove Background */}
      <rect
        fill="#ffffff"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        width="23.304855"
        height="21.811279"
        x="0.34757233"
        y="0.32529697"
        ry="0.89719015" 
      />

      {/* 2. Top Right Circle */}
      <circle
        fill="#ffffff"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        cx="16.910463"
        cy="6.3525558"
        r="3.7211401" 
      />

      {/* 3. Bottom Left Circle */}
      <circle
        fill="#ffffff"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        id="path9-8-2"
        cx="7.1393528"
        cy="14.635365"
        r="3.7211401" 
      />

      {/* 4. Top Left Circle */}
      <circle
        fill="#ffffff"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        id="path9"
        cx="6.3215318"
        cy="5.6542916"
        r="3.0096719" 
      />

      {/* 5. Bottom Right Circle */}
      <circle
        fill="#ffffff"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        id="path9-1"
        cx="17.657566"
        cy="15.393929"
        r="3.0096719" 
      />

      {/* 6. Buttons */}
      <path
        fill="#ffffff"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m 8.9462117,20.256733 h 0.462577"
      />

      {/* 6. Buttons */}
      <path
        fill="#ffffff"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m 10.797836,20.256733 h 0.44314"
      />

      {/* 6. Buttons */}
      <path
        fill="#ffffff"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m 12.761314,20.256733 h 0.333258"
      />

      {/* 6. Buttons */}
      <path
        fill="#ffffff"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m 14.645958,20.256733 h 0.333258"
      />
          


    </svg>
  );
};

export const Custom_Fridge = ({
  x,
  y,
  width,
  height,
  anchorX,
  anchorY,
  length,
  stroke = "#000000",
  strokeWidth = Default_Thickness-0.25, // Bumped this up so it's actually visible! (2 pixels thick)
  fill = "none",
  className,
  ...props
}: any) => {
  const VB_W = 24, VB_H = 23.700272;
  const useAnchor = anchorX != null && anchorY != null && (length != null || width != null);
  const rW = useAnchor ? (width != null ? width : (length as number) * (VB_W / VB_H)) : width;
  const rH = useAnchor ? (length != null ? length : (width as number) * (VB_H / VB_W)) : height;
  const rX = useAnchor ? anchorX - rW / 2 : x;
  const rY = useAnchor ? anchorY : y;

  return (
    <svg
      x={rX}       // Now using your calculated X
      y={rY}       // Now using your calculated Y
      width={rW}   // Now using your calculated Width
      height={rH}  // Now using your calculated Height
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      {...props}
    >

                  
      {/* 1. Fridge Background */}
      <rect
        fill="#ffffff"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        width="23.651226"
        height="21.852861"
        x="0.17438704"
        y="0.17438699" 
      />

      {/* 2. Handles */}
      <rect
        fill="#ffffff"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        width="1.0626709"
        height="1.498638"
        x="10.525205"
        y="22.027248"
        ry="0" 
      />
    
      {/* 3. Handles */}
      <rect
        fill="#ffffff"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        width="1.0626709"
        height="1.498638"
        x="12.354223"
        y="22.027248"
        ry="0" 
      />

      {/* 4. Lines */}
      <path
        fill="#ffffff"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M 0.17438704,20.450303 H 23.825613"
      />

      {/* 5. Lines */}
      <path
        fill="#ffffff"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m 12,20.450303 v 1.576945"
    
      />
          


    </svg>
  );
};

export const Custom_Single_Cabinet = ({
  x,
  y,
  width,
  height,
  anchorX,
  anchorY,
  length,
  stroke = "#000000",
  strokeWidth = Default_Thickness-0.5, // Bumped this up so it's actually visible! (2 pixels thick)
  fill = "none",
  className,
  ...props
}: any) => {
  const VB_W = 12.089741, VB_H = 8.2935019;
  const useAnchor = anchorX != null && anchorY != null && (length != null || width != null);
  const rW = useAnchor ? (width != null ? width : (length as number) * (VB_W / VB_H)) : width;
  const rH = useAnchor ? (length != null ? length : (width as number) * (VB_H / VB_W)) : height;
  const rX = useAnchor ? anchorX - rW / 2 : x;
  const rY = useAnchor ? anchorY : y;

  return (
    <svg
      x={rX}       // Now using your calculated X
      y={rY}       // Now using your calculated Y
      width={rW}   // Now using your calculated Width
      height={rH}  // Now using your calculated Height
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      {...props}
    >
      <g transform="translate(-6.5052333,0.03326012)">

          
        {/* Background */}
        <rect
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          width="11.839741"
          height="8.0435019"
          x="6.6302333"
          y="0.091739878"
          ry="0.19615059"
        />
        
        {/* Dashed Line */}
        <path
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth-0.1}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M 18.469974,7.6291375 H 6.6302333"
          strokeDasharray={0.5}
        />

      </g>
    </svg>
  );
};


export const Custom_Double_Cabinet = ({
  x,
  y,
  width,
  height,
  anchorX,
  anchorY,
  length,
  stroke = "#000000",
  strokeWidth = Default_Thickness-0.5, // Bumped this up so it's actually visible! (2 pixels thick)
  fill = "none",
  className,
  ...props
}: any) => {
  const VB_W = 24, VB_H = 8.3640213;
  const useAnchor = anchorX != null && anchorY != null && (length != null || width != null);
  const rW = useAnchor ? (width != null ? width : (length as number) * (VB_W / VB_H)) : width;
  const rH = useAnchor ? (length != null ? length : (width as number) * (VB_H / VB_W)) : height;
  const rX = useAnchor ? anchorX - rW / 2 : x;
  const rY = useAnchor ? anchorY : y;

  return (
    <svg
      x={rX}       // Now using your calculated X
      y={rY}       // Now using your calculated Y
      width={rW}   // Now using your calculated Width
      height={rH}  // Now using your calculated Height
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      {...props}
    >
      <g transform="translate(-0.55010368,0.03326012)">

          
        {/* Background */}
        <rect
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          width="23.679482"
          height="8.0435019"
          x="0.71036291"
          y="0.1269991"
          ry="0.19615059"
        />
        
        {/* Dashed Line */}
        <path
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth-0.1}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M 24.389845,7.6291375 H 0.70761306"
          strokeDasharray={0.5}
        />

        {/* Door Line */}
        <path
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M 12.550104,8.1705016 V 7.6291375"
        />
      </g>
    </svg>
  );
};


export const Custom_Kitchen_Island = ({
  x,
  y,
  width,
  height,
  anchorX,
  anchorY,
  length,
  stroke = "#000000",
  strokeWidth = Default_Thickness-0.5, // Bumped this up so it's actually visible! (2 pixels thick)
  fill = "none",
  className,
  ...props
}: any) => {
  const VB_W = 24, VB_H = 9.0572395;
  const useAnchor = anchorX != null && anchorY != null && (length != null || width != null);
  const rW = useAnchor ? (width != null ? width : (length as number) * (VB_W / VB_H)) : width;
  const rH = useAnchor ? (length != null ? length : (width as number) * (VB_H / VB_W)) : height;
  const rX = useAnchor ? anchorX - rW / 2 : x;
  const rY = useAnchor ? anchorY : y;

  return (
    <svg
      x={rX}       // Now using your calculated X
      y={rY}       // Now using your calculated Y
      width={rW}   // Now using your calculated Width
      height={rH}  // Now using your calculated Height
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      {...props}
    >
      <g transform="translate(-0.55010363,0.03325949)">
        <g transform="matrix(1.0654827,0,0,1.0654827,-1.0499735,-11.204213)">


          {/* 2. Island Base */}
          <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="22.375002"
            height="7.9365349"
            x="1.5767392"
            y="10.559406"
            ry="0.1373584" 
          />
         
         <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth-0.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="5.59375"
            height="0.4140625"
            x="1.5767392"
            y="18.495941"
         />
         
         <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth-0.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="5.59375"
            height="0.4140625"
            x="7.1704893"
            y="18.495941"
         />
         
         <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth-0.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="5.59375"
            height="0.4140625"
            x="12.764239"
            y="18.495941"
         />
         
         <rect
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={strokeWidth-0.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            width="5.59375"
            height="0.4140625"
            x="18.35799"
            y="18.495941"
         />

          <g transform="matrix(0.5,0,0,0.4,5,10.714932)">
                  
            {/* 1. SINK */}
            <rect
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              width="22.01771"
              height="9.1415796"
              x="5.3098993"
              y="7.5017395"
              ry="0.99755609" 
            />
            
            <rect
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              width="4.431159"
              height="0.59998101"
              x="22.216059"
              y="8.7958021"
              ry="0.2999905" 
            />
            
            <rect
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              width="4.431159"
              height="0.59998101"
              x="22.216059"
              y="10.006765"
              ry="0.2999905" 
            />
            
            <rect
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              width="4.431159"
              height="0.59998101"
              x="22.216059"
              y="11.233048"
              ry="0.2999905" 
            />
            
            <rect
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              width="4.431159"
              height="0.59998101"
              x="22.216059"
              y="12.444011"
              ry="0.2999905" 
            />
            
            <rect
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              width="4.431159"
              height="0.59998101"
              x="22.216059"
              y="13.615599"
              ry="0.2999905" 
            />
            
            <rect
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              width="4.431159"
              height="0.59998101"
              x="22.216059"
              y="14.826561"
              ry="0.2999905" 
            />
            
            <rect
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              width="15.48299"
              height="7.6366444"
              x="5.9513617"
              y="8.4715452"
              ry="0.91466844" 
            />
            
            <rect
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              width="6.970789"
              height="6.7385426"
              x="6.4545684"
              y="8.9420586"
              ry="0.61893141" 
            />
            
            <rect
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              width="6.970789"
              height="6.7385426"
              x="13.956083"
              y="8.9420586"
              ry="0.61893141" 
            />
            
            <circle
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              cx="9.9336176"
              cy="12.31133"
              r="0.57438093" 
            />
            
            <circle
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              cx="17.44795"
              cy="12.31133"
              r="0.57438093" 
            />
            
            <path
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m 13.706947,8.5597079 1.117082,0.9784507 0.296303,-0.3537491 -1.073407,-0.868604"
            />
            
            <circle
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              cx="13.627394"
              cy="8.2064123"
              r="0.56526387" 
            />
          </g>
          
          
          
        </g>
      </g>
    </svg>
  );
};