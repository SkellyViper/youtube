import React from 'react';
import {Grain} from '../../components/backdrop/Backdrop';

/** Film grain on top of everything (static texture, never animated). */
export const GrainLayer: React.FC = () => <Grain opacity={0.065} />;
