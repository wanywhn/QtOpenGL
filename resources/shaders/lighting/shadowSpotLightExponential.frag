/*******************************************************************************
 * lighting/shadowSpotLight.frag
 *------------------------------------------------------------------------------
 * Apply the lighting calculation to a given fragment of incident light.
 * Uses GBuffer information to access statistics about the scene itself.
 ******************************************************************************/

#include <LightBuffer.ubo>
#include <GBuffer.ubo>
#include <Math.glsl> // saturate
#include <Bindings.glsl>

layout(binding = K_TEXTURE_0)
uniform sampler2D shadowMap;

// Light Input
in highp mat4 vViewToLightBias;
uniform highp float k = 60.0;

// Light Output
layout(location = 0) out highp vec4 fFragColor;

void main()
{
  // GBuffer Access
  highp vec3 viewPos  = viewPosition();
  highp vec3 normal   = normal();
  highp vec3 diffuse  = diffuse();
  highp vec4 specular = specular();

  // Light Information
  highp vec3  lightVec   = Light.ViewPosition - viewPos;
  highp float lightDist  = length(lightVec);

  // Construct a finite attenuation
  highp vec3  lightDir   = lightVec / lightDist;
  highp vec3  polynomial = vec3(1.0, lightDist, lightDist * lightDist);
  highp float attenuation = 1.0 / dot(polynomial,Light.Attenuation);
  highp float linearDist  = lightDist / Light.MaxFalloff;
  attenuation *= saturate(1.0 - linearDist);

  // Blinn Phong
  highp float lambertian = max(dot(lightDir, normal), 0.0);
  highp vec3  viewDir    = normalize(-viewPos);
  highp vec3  halfDir    = normalize(lightDir + viewDir);
  highp float specAngle  = max(dot(halfDir, normal), 0.0);
  highp float specFactor = pow(specAngle, specular.w);

  // Spotlight Factor
  highp float spotAngle  = dot(-lightDir, Light.ViewDirection);
  highp float spotFactor = smoothstep(Light.OuterAngle, Light.InnerAngle, spotAngle);

  // Shadow Effect
  vec4 shadowCoord = vViewToLightBias * vec4(viewPos, 1.0);
  float occluder = textureProj(shadowMap, shadowCoord.xyw).r;
  float reciever = map_01(shadowCoord.w, Light.NearPlane, Light.MaxFalloff);
  float visibility = saturate(occluder * exp(-Light.Exponential * reciever));

  // Construct Lighting Terms
  highp vec3 diffuseTerm  = Light.Diffuse  * diffuse      * lambertian;
  highp vec3 specularTerm = Light.Specular * specular.xyz * specFactor;
  highp vec3 lighting = visibility * spotFactor * attenuation * (diffuseTerm + specularTerm);
  lighting = pow(lighting, vec3(2.2));
  fFragColor = vec4(lighting, 1.0);

  // Debug Drawing
  //fFragColor += debugExecution(visibility * spotFactor * attenuation);
}
